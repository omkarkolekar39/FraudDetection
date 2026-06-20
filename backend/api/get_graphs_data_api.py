from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
import numpy as np

from config.db_config import get_db
from services.login_service import get_current_user
from services.persistence_service import hydrate_runtime_state

router = APIRouter()


def _norm_cat(cat: str) -> str:
    cleaned = str(cat).lower().replace(" risk", "").strip()
    if "high" in cleaned:
        return "high"
    if "med" in cleaned or "mid" in cleaned:
        return "medium"
    return "low"


def _build_sample_indices(total: int, limit: int, seed: int = 42) -> list[int]:
    if total <= limit:
        return list(range(total))

    state = seed

    def random() -> float:
        nonlocal state
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        return state / 0xFFFFFFFF

    indices = list(range(total))
    for index in range(total - 1, 0, -1):
        swap_index = int(random() * (index + 1))
        indices[index], indices[swap_index] = indices[swap_index], indices[index]

    return sorted(indices[:limit])


def _evenly_space_indices(indices: list[int], limit: int) -> list[int]:
    if len(indices) <= limit:
        return indices

    slots = np.linspace(0, len(indices) - 1, num=limit, dtype=int)
    return [indices[position] for position in slots]


def _count_window(categories: list[str], indices: list[int]) -> tuple[int, int, int]:
    window_categories = [categories[index] for index in indices]
    return (
        window_categories.count("high"),
        window_categories.count("medium"),
        window_categories.count("low"),
    )


@router.get("/graphs/")
async def get_graphs_data(
    request: Request,
    db: Session = Depends(get_db),
    include_raw: bool = Query(False),
    mode: str = Query("summary"),
    start: int | None = Query(None),
    end: int | None = Query(None),
    limit: int = Query(200, ge=1, le=200),
    user=Depends(get_current_user),
):
    """
    Supplies summary metadata for dashboards and a capped raw chart payload for Analytics.
    """
    try:
        if (
            getattr(request.app.state, "raw_df", None) is None
            and not getattr(request.app.state, "categories", [])
        ):
            hydrate_runtime_state(request, db)

        cats = getattr(request.app.state, "categories", [])
        raw_df = getattr(request.app.state, "raw_df", None)
        ae_errors = getattr(request.app.state, "ae_errors", [])
        if_scores = getattr(request.app.state, "if_scores", [])
        final_scores = getattr(request.app.state, "scores", [])
        row_nums = getattr(request.app.state, "result_row_nums", [])
        persisted_summary = getattr(request.app.state, "persisted_summary", None)
        thresholds = getattr(request.app.state, "thresholds", {"high": 70.0, "medium": 30.0})

        if not cats:
            if persisted_summary:
                total_on_disk = int(persisted_summary.get("total_records", 0))
                total_high = int(persisted_summary.get("total_high_risk", 0))
                total_medium = int(persisted_summary.get("total_medium_risk", 0))
                total_low = int(persisted_summary.get("total_low_risk", 0))
                return {
                    "status": "success",
                    "metadata": {
                        "total_records": total_on_disk,
                        "total_high_risk": total_high,
                        "total_medium_risk": total_medium,
                        "total_low_risk": total_low,
                        "risk_exposure": round((total_high / total_on_disk) * 100, 1) if total_on_disk > 0 else 0.0,
                        "ae_avg_pct": float(persisted_summary.get("ae_avg_pct", 0)),
                        "if_pct": float(persisted_summary.get("if_pct", 0)),
                        "high_threshold": float(persisted_summary.get("high_threshold", thresholds.get("high", 70.0))),
                        "medium_threshold": float(persisted_summary.get("medium_threshold", thresholds.get("medium", 30.0))),
                    },
                    "window_metadata": {
                        "mode": mode,
                        "from_record": 1,
                        "to_record": 0,
                        "total_in_window": 0,
                        "rendered_records": 0,
                        "high_count": 0,
                        "medium_count": 0,
                        "low_count": 0,
                        "limited": False,
                    },
                    "distribution": [
                        {"name": "Low Risk", "value": total_low, "fill": "#22c55e"},
                        {"name": "Medium Risk", "value": total_medium, "fill": "#facc15"},
                        {"name": "High Risk", "value": total_high, "fill": "#ef4444"},
                    ],
                    "ae_errors_raw": [],
                    "if_scores_raw": [],
                    "risk_scores_raw": [],
                }

            total_on_disk = len(raw_df) if raw_df is not None else 0
            return {
                "status": "waiting",
                "metadata": {
                    "total_records": int(total_on_disk),
                    "total_high_risk": 0,
                    "total_medium_risk": 0,
                    "total_low_risk": 0,
                    "risk_exposure": 0.0,
                    "ae_avg_pct": 0,
                    "if_pct": 0,
                    "high_threshold": float(thresholds.get("high", 70.0)),
                    "medium_threshold": float(thresholds.get("medium", 30.0)),
                },
                "window_metadata": {
                    "mode": mode,
                    "from_record": 1,
                    "to_record": 0,
                    "total_in_window": 0,
                    "rendered_records": 0,
                    "high_count": 0,
                    "medium_count": 0,
                    "low_count": 0,
                    "limited": False,
                },
                "distribution": [],
                "ae_errors_raw": [],
                "if_scores_raw": [],
                "risk_scores_raw": [],
            }

        categories = [_norm_cat(cat) for cat in cats]
        using_sampled_results = bool(
            persisted_summary
            and getattr(request.app.state, "persisted_sample_only", False)
            and raw_df is None
        )

        if using_sampled_results:
            total = int(persisted_summary.get("total_records", len(categories)))
            total_high = int(persisted_summary.get("total_high_risk", categories.count("high")))
            total_medium = int(persisted_summary.get("total_medium_risk", categories.count("medium")))
            total_low = int(persisted_summary.get("total_low_risk", categories.count("low")))
        else:
            total = len(categories)
            total_high = categories.count("high")
            total_medium = categories.count("medium")
            total_low = categories.count("low")

        total_available_rows = len(categories)

        normalized_mode = mode.strip().lower()
        if normalized_mode == "range" and total_available_rows > 0:
            from_record = max(1, min(start or 1, total_available_rows))
            to_record = max(from_record, min(end or from_record, total_available_rows))
            full_window_indices = list(range(from_record - 1, to_record))
        elif normalized_mode == "sample":
            from_record = 1
            to_record = min(limit, total)
            full_window_indices = _build_sample_indices(len(categories), limit)
        else:
            from_record = 1
            to_record = total_available_rows if using_sampled_results else total
            full_window_indices = list(range(len(categories)))

        rendered_indices = _evenly_space_indices(full_window_indices, limit) if include_raw else []
        window_high, window_medium, window_low = _count_window(categories, full_window_indices)

        ae_errors_raw: list[dict[str, object]] = []
        if_scores_raw: list[dict[str, object]] = []
        risk_scores_raw: list[dict[str, object]] = []

        if include_raw:
            for index in rendered_indices:
                category = categories[index]
                row_num = row_nums[index] if index < len(row_nums) else index + 1
                account_id = f"RECORD {row_num}"

                if index < len(ae_errors):
                    ae_errors_raw.append(
                        {
                            "row_num": row_num,
                            "account_id": account_id,
                            "ae_error": float(ae_errors[index]),
                            "category": category,
                        }
                    )

                if index < len(if_scores):
                    if_scores_raw.append(
                        {
                            "row_num": row_num,
                            "account_id": account_id,
                            "if_score": float(if_scores[index]),
                            "category": category,
                        }
                    )

                if index < len(final_scores):
                    risk_scores_raw.append(
                        {
                            "row_num": row_num,
                            "account_id": account_id,
                            "blended_score": float(final_scores[index]),
                            "category": category,
                        }
                    )

        if using_sampled_results:
            ae_avg = float(persisted_summary.get("ae_avg_pct", 0))
            if_avg = float(persisted_summary.get("if_pct", 0))
        else:
            ae_avg = round(np.mean(ae_errors) * 100, 1) if ae_errors else 0
            if_avg = round(np.mean(if_scores) * 100, 1) if if_scores else 0

        return {
            "status": "success",
            "metadata": {
                "total_records": int(total),
                "total_high_risk": int(total_high),
                "total_medium_risk": int(total_medium),
                "total_low_risk": int(total_low),
                "risk_exposure": round((total_high / total) * 100, 1) if total > 0 else 0.0,
                "ae_avg_pct": ae_avg,
                "if_pct": if_avg,
                "high_threshold": float(
                    persisted_summary.get("high_threshold", thresholds.get("high", 70.0))
                    if persisted_summary else thresholds.get("high", 70.0)
                ),
                "medium_threshold": float(
                    persisted_summary.get("medium_threshold", thresholds.get("medium", 30.0))
                    if persisted_summary else thresholds.get("medium", 30.0)
                ),
            },
            "window_metadata": {
                "mode": normalized_mode,
                "from_record": int(from_record),
                "to_record": int(
                    min(
                        to_record,
                        row_nums[rendered_indices[-1]] if rendered_indices and rendered_indices[-1] < len(row_nums) else to_record,
                    )
                    if using_sampled_results and normalized_mode == "sample"
                    else to_record
                ),
                "total_in_window": int(len(full_window_indices)),
                "rendered_records": int(len(rendered_indices)),
                "high_count": int(window_high),
                "medium_count": int(window_medium),
                "low_count": int(window_low),
                "limited": bool(include_raw and len(full_window_indices) > len(rendered_indices)),
            },
            "distribution": [
                {"name": "Low Risk", "value": total_low, "fill": "#22c55e"},
                {"name": "Medium Risk", "value": total_medium, "fill": "#facc15"},
                {"name": "High Risk", "value": total_high, "fill": "#ef4444"},
            ],
            "ae_errors_raw": ae_errors_raw,
            "if_scores_raw": if_scores_raw,
            "risk_scores_raw": risk_scores_raw,
        }
    except Exception as error:
        print(f"Graph data failed: {error}")
        return {
            "status": "error",
            "message": str(error),
            "metadata": {"total_records": 0},
            "window_metadata": {
                "mode": mode,
                "from_record": 1,
                "to_record": 0,
                "total_in_window": 0,
                "rendered_records": 0,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0,
                "limited": False,
            },
            "distribution": [],
            "ae_errors_raw": [],
            "if_scores_raw": [],
            "risk_scores_raw": [],
        }
