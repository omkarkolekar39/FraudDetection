from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from config.db_config import get_db
from database.user_table import User
from services.login_service import get_current_user
from services.persistence_service import hydrate_runtime_state
import numpy as np

router = APIRouter()


@router.get("/")
async def get_dashboard_metrics(
        request: Request,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    try:
        if getattr(request.app.state, 'raw_df', None) is None:
            hydrate_runtime_state(request, db)

        df = getattr(request.app.state, 'raw_df', None)
        categories = getattr(request.app.state, 'categories', [])
        persisted_summary = getattr(request.app.state, 'persisted_summary', None)

        # count approved users for dashboard cards
        active_staff = db.query(User).filter(User.is_pending_approval == False).count()

        if not categories or len(categories) == 0:
            if persisted_summary:
                total_uploaded = int(persisted_summary.get("total_records", 0))
                total_high = int(persisted_summary.get("total_high_risk", 0))
                total_medium = int(persisted_summary.get("total_medium_risk", 0))
                total_low = int(persisted_summary.get("total_low_risk", 0))
                return {
                    "status": "success",
                    "metadata": {
                        "total_records": total_uploaded,
                        "total_high_risk": total_high,
                        "total_medium_risk": total_medium,
                        "total_low_risk": total_low,
                        "risk_exposure": round((total_high / total_uploaded) * 100, 1) if total_uploaded > 0 else 0.0,
                        "active_analysts": int(active_staff),
                        "ae_avg_pct": float(persisted_summary.get("ae_avg_pct", 0)),
                        "if_pct": float(persisted_summary.get("if_pct", 0)),
                    }
                }

            total_uploaded = len(df) if df is not None else 0
            return {
                "status": "waiting",
                "metadata": {
                    "total_records": int(total_uploaded),
                    "total_high_risk": 0,
                    "total_medium_risk": 0,
                    "total_low_risk": 0,
                    "risk_exposure": 0.0,
                    "active_analysts": int(active_staff),
                    "ae_avg_pct": 0,
                    "if_pct": 0
                }
            }

        if persisted_summary and getattr(request.app.state, 'persisted_sample_only', False) and df is None:
            t_high = int(persisted_summary.get("total_high_risk", 0))
            t_med = int(persisted_summary.get("total_medium_risk", 0))
            t_low = int(persisted_summary.get("total_low_risk", 0))
            total = int(persisted_summary.get("total_records", 0))
        else:
            cats_clean = [str(c).lower().strip() for c in categories]
            t_high = sum(1 for c in cats_clean if "high" in c)
            t_med = sum(1 for c in cats_clean if "medium" in c or "mid" in c)
            t_low = sum(1 for c in cats_clean if "low" in c)
            total = len(categories)

        ae_scores = getattr(request.app.state, 'ae_errors', [])
        if_scores = getattr(request.app.state, 'if_scores', [])

        if persisted_summary and getattr(request.app.state, 'persisted_sample_only', False) and df is None:
            ae_avg = float(persisted_summary.get("ae_avg_pct", 0))
            if_avg = float(persisted_summary.get("if_pct", 0))
        else:
            ae_avg = round(np.mean(ae_scores) * 100, 1) if ae_scores else 0
            if_avg = round(np.mean(if_scores) * 100, 1) if if_scores else 0

        return {
            "status": "success",
            "metadata": {
                "total_records": int(total),
                "total_high_risk": int(t_high),
                "total_medium_risk": int(t_med),
                "total_low_risk": int(t_low),
                "risk_exposure": round((t_high / total) * 100, 1) if total > 0 else 0.0,
                "active_analysts": int(active_staff),
                "ae_avg_pct": ae_avg,
                "if_pct": if_avg
            }
        }

    except Exception as e:
        print(f"Dashboard stats failed: {e}")
        return {
            "status": "error",
            "metadata": {
                "total_records": 0,
                "total_high_risk": 0,
                "total_medium_risk": 0,
                "total_low_risk": 0,
                "risk_exposure": 0.0,
                "active_analysts": 1
            }
        }
