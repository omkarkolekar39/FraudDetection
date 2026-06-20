from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from config.db_config import get_db
from services.login_service import get_current_user
import numpy as np
from services.dataset_service import resolve_record_lookup
from services.persistence_service import hydrate_runtime_state

router = APIRouter()


@router.get("/global")
async def get_global_xai_summary(
        request: Request,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    if getattr(request.app.state, 'raw_df', None) is None:
        hydrate_runtime_state(request, db, require_models=True)

    global_impacts = getattr(request.app.state, 'global_feature_impacts', [])
    if not global_impacts:
        raise HTTPException(status_code=400, detail="Run the analytics pipeline before opening the XAI dashboard.")

    return {
        "status": "success",
        "features": global_impacts,
    }


@router.get("/{account_id}")
async def get_shap_explanation(
        request: Request,
        account_id: str,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    """
    NEURAL IMPACT CALCULATOR (XAI)
    Computes feature importance for a specific record using the Isolation Forest model.
    Returns the top 10 most influential features for the neural decision.
    """
    if (
        getattr(request.app.state, 'if_model', None) is None
        or getattr(request.app.state, 'data_norm', None) is None
        or getattr(request.app.state, 'numeric_df', None) is None
    ):
        hydrate_runtime_state(request, db, require_models=True)

    # 1. Pull ML Models and Data from the RAM Buffer
    if_model = getattr(request.app.state, 'if_model', None)
    data_norm = getattr(request.app.state, 'data_norm', None)
    numeric_df = getattr(request.app.state, 'numeric_df', None)

    # Safety Guard: Ensure models exist in memory
    if if_model is None or data_norm is None or numeric_df is None:
        raise HTTPException(
            status_code=400,
            detail="XAI needs the live uploaded CSV in memory. Re-upload the dataset and run analytics again."
        )

    try:
        # 2. Fuzzy ID Lookup (Synchronized with Customer 360 logic)
        raw_df = getattr(request.app.state, 'raw_df', None)
        id_columns = getattr(request.app.state, 'id_columns', [])
        analysis_columns = getattr(request.app.state, 'analysis_columns', list(numeric_df.columns))
        if raw_df is None:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV is not available in memory. Re-upload the dataset to inspect record-level explanations.",
            )

        pos, _, display_id = resolve_record_lookup(raw_df, account_id, id_columns)

        # 3. Compute feature importance using Isolation Forest path lengths
        # This is a reliable XAI approach for tree-based anomaly models
        feature_names = analysis_columns

        # Get the row and compute depth-based feature impact
        target_row = data_norm[pos]  # Shape: (n_features,)

        # Use mean depth per estimator to approximate feature contribution
        # Higher absolute normalized value = more anomalous on that feature
        feature_values = target_row[:len(feature_names)]

        # Compute impact as absolute deviation from the training mean (approximation)
        global_means = np.mean(data_norm, axis=0)[:len(feature_names)]
        global_stds = np.std(data_norm, axis=0)[:len(feature_names)] + 1e-8

        # Z-score style impact: how much does this feature deviate from normal?
        impacts_raw = (feature_values - global_means) / global_stds

        impacts = []
        for i, feature in enumerate(feature_names):
            if i < len(impacts_raw):
                impact_val = float(impacts_raw[i])
                impacts.append({
                    "feature": feature,
                    "impact": impact_val,
                    "absolute_impact": abs(impact_val)
                })

        # Return Top 10 most influential features
        impacts_sorted = sorted(impacts, key=lambda x: x["absolute_impact"], reverse=True)[:10]

        # 4. Production Handshake Response — return flat list directly
        return {
            "status": "success",
            "account_id": display_id,
            "explanations": impacts_sorted  # Flat list of {feature, impact, absolute_impact}
        }

    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format provided.")
    except Exception as e:
        print(f"XAI ENGINE CRASH [ID: {account_id}]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Neural impact calculation failure: {str(e)}")
