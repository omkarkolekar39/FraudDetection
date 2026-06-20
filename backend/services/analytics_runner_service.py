import numpy as np
import pandas as pd
from datetime import datetime

from ml_engine.data_cleaner import clean_and_normalize_data
from ml_engine.autoencoder_model import train_and_score_autoencoder
from ml_engine.isolation_forest_model import train_and_score_isolation_forest
from ml_engine.risk_blender import calculate_blended_risk


def execute_ml_pipeline(request, db, username: str):
    df = getattr(request.app.state, 'raw_df', None)
    thresh = getattr(request.app.state, 'thresholds', {"high": 70.0, "medium": 30.0})
    user_ignored_columns = getattr(request.app.state, 'user_ignored_columns', [])

    if df is None:
        raise ValueError("System Memory Error: raw_df is empty. Please upload data first.")

    try:
        # clean and scale numeric data
        numeric_df, data_norm, scaler, id_columns, analysis_columns = clean_and_normalize_data(
            df,
            user_ignored_columns,
        )

        ae_model, ae_errors = train_and_score_autoencoder(data_norm)
        if_model, if_scores = train_and_score_isolation_forest(data_norm)

        final_scores, categories = calculate_blended_risk(
            ae_errors,
            if_scores,
            float(thresh["high"]),
            float(thresh["medium"])
        )

        # keep app state JSON-safe for APIs
        request.app.state.ae_errors = [float(e) for e in ae_errors]
        request.app.state.if_scores = [float(s) for s in if_scores]
        request.app.state.scores = [float(s) for s in final_scores]
        request.app.state.result_row_nums = list(range(1, len(final_scores) + 1))
        request.app.state.categories = [
            str(c).replace(" Risk", "").lower().strip() for c in categories
        ]

        request.app.state.if_model = if_model
        request.app.state.ae_model = ae_model
        request.app.state.data_norm = data_norm

        request.app.state.numeric_df = numeric_df
        request.app.state.scaler = scaler
        request.app.state.id_columns = id_columns
        request.app.state.analysis_columns = analysis_columns
        request.app.state.ignored_columns = list(user_ignored_columns)
        request.app.state.score_scaling = {
            "ae_min": float(np.min(ae_errors)) if len(ae_errors) else 0.0,
            "ae_max": float(np.max(ae_errors)) if len(ae_errors) else 0.0,
            "if_min": float(np.min(if_scores)) if len(if_scores) else 0.0,
            "if_max": float(np.max(if_scores)) if len(if_scores) else 0.0,
        }
        request.app.state.global_feature_impacts = sorted(
            [
                {
                    "feature": feature,
                    "impact": float(np.mean(np.abs(data_norm[:, index]))),
                }
                for index, feature in enumerate(analysis_columns)
            ],
            key=lambda entry: entry["impact"],
            reverse=True,
        )[:10]
        request.app.state.last_run = datetime.now().strftime("%Y-%m-%d %H:%M:%S")


        t_high = request.app.state.categories.count("high")
        t_med = request.app.state.categories.count("medium")
        t_low = request.app.state.categories.count("low")
        request.app.state.persisted_summary = {
            "total_records": int(len(final_scores)),
            "total_high_risk": int(t_high),
            "total_medium_risk": int(t_med),
            "total_low_risk": int(t_low),
            "ae_avg_pct": round(float(np.mean(ae_errors)) * 100, 1) if len(ae_errors) else 0.0,
            "if_pct": round(float(np.mean(if_scores)) * 100, 1) if len(if_scores) else 0.0,
            "high_threshold": float(thresh["high"]),
            "medium_threshold": float(thresh["medium"]),
            "stored_result_rows": 0,
            "result_storage_mode": "memory",
        }

        return {
            "status": "success",
            "processed_records": int(len(final_scores)),
            "high_risk_found": t_high,
            "medium_risk_found": t_med,
            "low_risk_found": t_low,
            "timestamp": request.app.state.last_run
        }

    except Exception as e:
        print(f"ML pipeline failed: {str(e)}")
        # Optionally log error
        raise RuntimeError(f"ML Pipeline failed during analysis: {e}")
