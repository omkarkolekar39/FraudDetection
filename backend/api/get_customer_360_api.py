from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from config.db_config import get_db
from services.login_service import get_current_user
import numpy as np
import pandas as pd
import torch
from ml_engine.risk_blender import calculate_single_blended_risk
from services.dataset_service import resolve_record_lookup, sanitize_record
from services.persistence_service import hydrate_runtime_state

router = APIRouter()


@router.get("/{account_id}")
async def get_customer_profile(
        request: Request,
        account_id: str,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    if getattr(request.app.state, 'raw_df', None) is None:
        hydrate_runtime_state(request, db)

    df = getattr(request.app.state, 'raw_df', None)
    scores = getattr(request.app.state, 'scores', [])
    categories = getattr(request.app.state, 'categories', [])
    ae_errors = getattr(request.app.state, 'ae_errors', [])
    if_scores = getattr(request.app.state, 'if_scores', [])

    if df is None:
        raise HTTPException(
            status_code=400,
            detail="Customer 360 needs the live uploaded CSV in memory. Re-upload the dataset to inspect raw record features.",
        )

    try:
        id_columns = getattr(request.app.state, 'id_columns', [])
        analysis_columns = getattr(request.app.state, 'analysis_columns', [])
        pos, idx_label, display_id = resolve_record_lookup(df, account_id, id_columns)

        target_row = df.loc[[idx_label]].replace([np.inf, -np.inf], np.nan).fillna("N/A")
        features_dict = sanitize_record(target_row.iloc[0].to_dict())
        simulation_features = {
            column: float(df.iloc[pos][column])
            for column in analysis_columns
            if column in df.columns
        }

        return {
            "status": "success",
            "data": {
                "Account_ID": display_id,
                "Risk_Score": float(scores[pos]) if pos < len(scores) else 0.0,
                "Risk_Category": str(categories[pos]) if pos < len(categories) else "Unprocessed",
                "AE_Loss": float(ae_errors[pos]) if pos < len(ae_errors) else 0.0,
                "IF_Score": float(if_scores[pos]) if pos < len(if_scores) else 0.0,
                "Features": features_dict,
                "Simulation_Features": simulation_features,
                "Analysis_Columns": analysis_columns,
                "Identifier_Columns": id_columns,
            }
        }

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as e:
        print(f"Customer profile failed: {e}")
        raise HTTPException(status_code=500, detail="Neural Reconstruction failure.")


@router.post("/{account_id}/simulate")
async def simulate_customer_profile(
        request: Request,
        account_id: str,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    if (
        getattr(request.app.state, 'raw_df', None) is None
        or getattr(request.app.state, 'if_model', None) is None
        or getattr(request.app.state, 'ae_model', None) is None
    ):
        hydrate_runtime_state(request, db, require_models=True)

    df = getattr(request.app.state, 'raw_df', None)
    if_model = getattr(request.app.state, 'if_model', None)
    ae_model = getattr(request.app.state, 'ae_model', None)
    scaler = getattr(request.app.state, 'scaler', None)
    analysis_columns = getattr(request.app.state, 'analysis_columns', [])
    score_scaling = getattr(request.app.state, 'score_scaling', {})
    thresholds = getattr(request.app.state, 'thresholds', {"high": 70.0, "medium": 30.0})
    data_norm = getattr(request.app.state, 'data_norm', None)
    id_columns = getattr(request.app.state, 'id_columns', [])
    scores = getattr(request.app.state, 'scores', [])
    categories = getattr(request.app.state, 'categories', [])
    ae_errors = getattr(request.app.state, 'ae_errors', [])
    if_scores = getattr(request.app.state, 'if_scores', [])

    if any(item is None for item in (df, if_model, ae_model, scaler, data_norm)) or not analysis_columns:
        raise HTTPException(
            status_code=400,
            detail="What-if simulation needs the live uploaded CSV in memory. Re-upload the dataset and run analytics again.",
        )

    try:
        payload = await request.json()
        overrides = payload.get("overrides", {})
        pos, idx_label, display_id = resolve_record_lookup(df, account_id, id_columns)

        simulated_row = df.loc[idx_label].copy()
        changed_fields = []
        for column, raw_value in overrides.items():
            if column not in analysis_columns:
                continue
            numeric_value = pd.to_numeric(raw_value, errors="coerce")
            if pd.isna(numeric_value):
                continue
            simulated_row[column] = float(numeric_value)
            changed_fields.append(column)

        ordered_features = pd.DataFrame([[simulated_row[column] for column in analysis_columns]], columns=analysis_columns)
        ordered_features = ordered_features.apply(pd.to_numeric, errors="coerce").fillna(0.0)
        scaled_row = scaler.transform(ordered_features.values)[0]

        ae_model.eval()
        with torch.no_grad():
            tensor_row = torch.FloatTensor([scaled_row])
            reconstructed = ae_model(tensor_row)
            ae_error = torch.mean((reconstructed - tensor_row) ** 2, dim=1).item()

        if_score = float(-if_model.decision_function([scaled_row])[0])
        blended_score, blended_category = calculate_single_blended_risk(
            ae_error,
            if_score,
            score_scaling,
            thresholds.get("high", 70.0),
            thresholds.get("medium", 30.0),
        )

        global_means = np.mean(data_norm, axis=0)
        global_stds = np.std(data_norm, axis=0) + 1e-8
        impacts_raw = (scaled_row - global_means) / global_stds
        explanations = sorted(
            [
                {
                    "feature": feature,
                    "impact": float(impacts_raw[index]),
                    "absolute_impact": abs(float(impacts_raw[index])),
                }
                for index, feature in enumerate(analysis_columns)
            ],
            key=lambda entry: entry["absolute_impact"],
            reverse=True,
        )[:10]

        return {
            "status": "success",
            "data": {
                "Account_ID": display_id,
                "Base_Profile": {
                    "Risk_Score": float(scores[pos]) if pos < len(scores) else 0.0,
                    "Risk_Category": str(categories[pos]) if pos < len(categories) else "Unprocessed",
                    "AE_Loss": float(ae_errors[pos]) if pos < len(ae_errors) else 0.0,
                    "IF_Score": float(if_scores[pos]) if pos < len(if_scores) else 0.0,
                },
                "Simulated_Profile": {
                    "Risk_Score": blended_score,
                    "Risk_Category": blended_category,
                    "AE_Loss": round(ae_error, 6),
                    "IF_Score": round(if_score, 6),
                    "Features": sanitize_record(simulated_row.to_dict()),
                },
                "Changed_Fields": changed_fields,
                "Analysis_Columns": analysis_columns,
            },
            "explanations": explanations,
        }
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except HTTPException:
        raise
    except Exception as error:
        print(f"SIMULATION FAILURE [{account_id}]: {error}")
        raise HTTPException(status_code=500, detail="What-if simulation failed.")
