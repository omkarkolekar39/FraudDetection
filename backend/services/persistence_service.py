from __future__ import annotations

import os

from sqlalchemy.orm import Session
import numpy as np

from database.platform_tables import AnalyticsResult, AnalyticsRun, BusinessAction, DatasetUpload, LiveStreamEvent, RiskSetting
from ml_engine.autoencoder_model import train_and_score_autoencoder
from ml_engine.data_cleaner import clean_and_normalize_data
from ml_engine.isolation_forest_model import train_and_score_isolation_forest
from services.dataset_service import detect_identifier_columns, get_serial_record_id

MAX_STORED_ANALYTICS_RESULTS = int(os.getenv("MAX_STORED_ANALYTICS_RESULTS", "0"))


def _build_persisted_result_indices(categories: list[str], limit: int) -> list[int]:
    all_indices = list(range(len(categories)))

    if limit <= 0 or len(all_indices) <= limit:
        return all_indices

    if limit <= 1:
        return [all_indices[0]]

    positions = sorted({int(index) for index in np.linspace(0, len(all_indices) - 1, num=limit)})
    return [all_indices[position] for position in positions]


def get_or_create_risk_settings(db: Session) -> RiskSetting:
    settings = db.query(RiskSetting).filter(RiskSetting.id == 1).first()
    if settings:
        return settings

    settings = RiskSetting(id=1, high_threshold=70.0, medium_threshold=30.0)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def set_runtime_thresholds(request, settings: RiskSetting) -> dict[str, float]:
    request.app.state.thresholds = {
        "high": float(settings.high_threshold),
        "medium": float(settings.medium_threshold),
    }
    return request.app.state.thresholds


def update_risk_settings(db: Session, high: float, medium: float, updated_by: str | None = None) -> RiskSetting:
    settings = get_or_create_risk_settings(db)
    settings.high_threshold = float(high)
    settings.medium_threshold = float(medium)
    settings.updated_by = updated_by
    db.commit()
    db.refresh(settings)
    return settings


def deactivate_previous_uploads(db: Session) -> None:
    db.query(DatasetUpload).filter(DatasetUpload.is_active == True).update(
        {DatasetUpload.is_active: False},
        synchronize_session=False,
    )


def deactivate_previous_runs(db: Session) -> None:
    db.query(AnalyticsRun).filter(AnalyticsRun.is_active == True).update(
        {AnalyticsRun.is_active: False},
        synchronize_session=False,
    )


def save_uploaded_dataset(
    db: Session,
    filename: str,
    uploaded_by: str,
    df,
    ignored_columns: list[str] | None = None,
) -> DatasetUpload:
    ignored_columns = [column for column in (ignored_columns or []) if column in df.columns]
    id_columns = detect_identifier_columns(df)

    deactivate_previous_uploads(db)
    deactivate_previous_runs(db)

    upload = DatasetUpload(
        filename=filename,
        uploaded_by=uploaded_by,
        total_records=int(len(df)),
        columns_detected=list(df.columns),
        ignored_columns=ignored_columns,
        id_columns=id_columns,
        is_active=True,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def get_active_dataset_upload(db: Session) -> DatasetUpload | None:
    return (
        db.query(DatasetUpload)
        .filter(DatasetUpload.is_active == True)
        .order_by(DatasetUpload.created_at.desc(), DatasetUpload.id.desc())
        .first()
    )


def get_active_analytics_run(db: Session, upload_id: int | None = None) -> AnalyticsRun | None:
    query = db.query(AnalyticsRun).filter(AnalyticsRun.is_active == True)
    if upload_id is not None:
        query = query.filter(AnalyticsRun.upload_id == upload_id)
    return query.order_by(AnalyticsRun.created_at.desc(), AnalyticsRun.id.desc()).first()


def save_analytics_run(
    db: Session,
    upload: DatasetUpload,
    triggered_by: str,
    thresholds: dict[str, float],
    request,
) -> AnalyticsRun:
    categories = list(getattr(request.app.state, "categories", []))
    scores = list(getattr(request.app.state, "scores", []))
    ae_errors = list(getattr(request.app.state, "ae_errors", []))
    if_scores = list(getattr(request.app.state, "if_scores", []))
    analysis_columns = list(getattr(request.app.state, "analysis_columns", []))
    id_columns = list(getattr(request.app.state, "id_columns", []))
    ignored_columns = list(getattr(request.app.state, "ignored_columns", []))
    global_feature_impacts = list(getattr(request.app.state, "global_feature_impacts", []))
    score_scaling = dict(getattr(request.app.state, "score_scaling", {}))

    total_records = len(categories)
    stored_indices = _build_persisted_result_indices(categories, MAX_STORED_ANALYTICS_RESULTS)
    high_risk_count = sum(1 for category in categories if "high" in str(category).lower())
    medium_risk_count = sum(1 for category in categories if "medium" in str(category).lower())
    low_risk_count = sum(1 for category in categories if "low" in str(category).lower())
    ae_avg_pct = round(float(np.mean(ae_errors)) * 100, 1) if ae_errors else 0.0
    if_avg_pct = round(float(np.mean(if_scores)) * 100, 1) if if_scores else 0.0

    deactivate_previous_runs(db)

    run = AnalyticsRun(
        upload_id=upload.id,
        triggered_by=triggered_by,
        high_threshold=float(thresholds.get("high", 70.0)),
        medium_threshold=float(thresholds.get("medium", 30.0)),
        total_records=total_records,
        high_risk_count=high_risk_count,
        medium_risk_count=medium_risk_count,
        low_risk_count=low_risk_count,
        ae_avg_pct=ae_avg_pct,
        if_avg_pct=if_avg_pct,
        score_scaling=score_scaling,
        global_feature_impacts=global_feature_impacts,
        analysis_columns=analysis_columns,
        id_columns=id_columns,
        ignored_columns=ignored_columns,
        status="completed",
        result_storage_mode="all" if len(stored_indices) == total_records else "limited",
        stored_result_rows=len(stored_indices),
        is_active=True,
    )
    db.add(run)
    db.flush()

    results = []
    for index in stored_indices:
        category = categories[index]
        results.append(
            AnalyticsResult(
                run_id=run.id,
                row_num=index + 1,
                record_id=get_serial_record_id(index),
                category=str(category),
                risk_score=float(scores[index]) if index < len(scores) else 0.0,
                ae_error=float(ae_errors[index]) if index < len(ae_errors) else 0.0,
                if_score=float(if_scores[index]) if index < len(if_scores) else 0.0,
            )
        )

    db.bulk_save_objects(results)
    db.commit()
    db.refresh(run)
    return run


def load_results_for_run(db: Session, run_id: int) -> list[AnalyticsResult]:
    return (
        db.query(AnalyticsResult)
        .filter(AnalyticsResult.run_id == run_id)
        .order_by(AnalyticsResult.row_num.asc())
        .all()
    )


def hydrate_runtime_state(request, db: Session, require_models: bool = False) -> bool:
    settings = get_or_create_risk_settings(db)
    set_runtime_thresholds(request, settings)

    active_upload = get_active_dataset_upload(db)
    if active_upload is None:
        return False

    request.app.state.active_upload_id = active_upload.id
    request.app.state.user_ignored_columns = list(active_upload.ignored_columns or [])
    request.app.state.id_columns = list(active_upload.id_columns or [])
    request.app.state.ignored_columns = list(request.app.state.user_ignored_columns)

    active_run = get_active_analytics_run(db, active_upload.id)
    if active_run is not None:
        results = load_results_for_run(db, active_run.id)
        request.app.state.active_run_id = active_run.id
        request.app.state.persisted_summary = {
            "total_records": int(active_run.total_records or 0),
            "total_high_risk": int(active_run.high_risk_count or 0),
            "total_medium_risk": int(active_run.medium_risk_count or 0),
            "total_low_risk": int(active_run.low_risk_count or 0),
            "ae_avg_pct": float(active_run.ae_avg_pct or 0.0),
            "if_pct": float(active_run.if_avg_pct or 0.0),
            "high_threshold": float(active_run.high_threshold or 70.0),
            "medium_threshold": float(active_run.medium_threshold or 30.0),
            "stored_result_rows": int(active_run.stored_result_rows or len(results)),
            "result_storage_mode": active_run.result_storage_mode or "all",
        }
        request.app.state.persisted_sample_only = (
            (active_run.result_storage_mode or "all") != "all"
            or int(active_run.stored_result_rows or len(results)) < int(active_run.total_records or len(results))
        )
        request.app.state.categories = [str(result.category).lower().replace(" risk", "").strip() for result in results]
        request.app.state.scores = [float(result.risk_score) for result in results]
        request.app.state.ae_errors = [float(result.ae_error) for result in results]
        request.app.state.if_scores = [float(result.if_score) for result in results]
        request.app.state.result_row_nums = [int(result.row_num) for result in results]
        request.app.state.analysis_columns = list(active_run.analysis_columns or [])
        request.app.state.score_scaling = dict(active_run.score_scaling or {})
        request.app.state.global_feature_impacts = list(active_run.global_feature_impacts or [])
        request.app.state.last_run = active_run.created_at.strftime("%Y-%m-%d %H:%M:%S") if active_run.created_at else "Never"
        request.app.state.thresholds = {
            "high": float(active_run.high_threshold),
            "medium": float(active_run.medium_threshold),
        }
    else:
        request.app.state.active_run_id = None
        request.app.state.categories = []
        request.app.state.scores = []
        request.app.state.ae_errors = []
        request.app.state.if_scores = []
        request.app.state.analysis_columns = []
        request.app.state.score_scaling = {}
        request.app.state.global_feature_impacts = []
        request.app.state.last_run = "Never"
        request.app.state.result_row_nums = []
        request.app.state.persisted_summary = None
        request.app.state.persisted_sample_only = False

    if getattr(request.app.state, "raw_df", None) is None:
        request.app.state.raw_df = None
        request.app.state.numeric_df = None
        request.app.state.data_norm = None
        request.app.state.scaler = None
        request.app.state.ae_model = None
        request.app.state.if_model = None
        return active_run is not None

    if require_models:
        numeric_df, data_norm, scaler, id_columns, analysis_columns = clean_and_normalize_data(
            request.app.state.raw_df,
            request.app.state.user_ignored_columns,
        )
        ae_model, generated_ae_errors = train_and_score_autoencoder(data_norm)
        if_model, generated_if_scores = train_and_score_isolation_forest(data_norm)

        request.app.state.numeric_df = numeric_df
        request.app.state.data_norm = data_norm
        request.app.state.scaler = scaler
        request.app.state.id_columns = id_columns
        request.app.state.analysis_columns = analysis_columns
        request.app.state.ae_model = ae_model
        request.app.state.if_model = if_model
        request.app.state.score_scaling = {
            "ae_min": float(np.min(generated_ae_errors)) if len(generated_ae_errors) else 0.0,
            "ae_max": float(np.max(generated_ae_errors)) if len(generated_ae_errors) else 0.0,
            "if_min": float(np.min(generated_if_scores)) if len(generated_if_scores) else 0.0,
            "if_max": float(np.max(generated_if_scores)) if len(generated_if_scores) else 0.0,
        }
        if not getattr(request.app.state, "global_feature_impacts", None):
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
    else:
        request.app.state.numeric_df = None
        request.app.state.data_norm = None
        request.app.state.scaler = None
        request.app.state.ae_model = None
        request.app.state.if_model = None

    return True


def save_business_action(
    db: Session,
    record_id: str,
    action_type: str,
    executed_by: str,
    executed_by_role: str,
    details: str | None = None,
) -> BusinessAction:
    action = BusinessAction(
        record_id=record_id,
        action_type=action_type,
        executed_by=executed_by,
        executed_by_role=executed_by_role,
        details=details,
        status="completed",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def persist_live_stream_result(
    db: Session,
    upload_id: int | None,
    run_id: int | None,
    source: str,
    row_num: int,
    record_id: str,
    category: str,
    risk_score: float,
    ae_error: float,
    if_score: float,
    payload: dict,
) -> LiveStreamEvent:
    if upload_id is not None:
        upload = db.query(DatasetUpload).filter(DatasetUpload.id == upload_id).first()
        if upload is not None:
            upload.total_records = int(upload.total_records or 0) + 1

    run = None
    if run_id is not None:
        run = db.query(AnalyticsRun).filter(AnalyticsRun.id == run_id).first()

    if run is not None:
        previous_total = int(run.total_records or 0)
        new_total = previous_total + 1

        run.total_records = new_total
        if category == "high":
            run.high_risk_count = int(run.high_risk_count or 0) + 1
        elif category == "medium":
            run.medium_risk_count = int(run.medium_risk_count or 0) + 1
        else:
            run.low_risk_count = int(run.low_risk_count or 0) + 1

        previous_ae_mean = float(run.ae_avg_pct or 0.0) / 100.0
        previous_if_mean = float(run.if_avg_pct or 0.0) / 100.0
        run.ae_avg_pct = round((((previous_ae_mean * previous_total) + float(ae_error)) / new_total) * 100, 1)
        run.if_avg_pct = round((((previous_if_mean * previous_total) + float(if_score)) / new_total) * 100, 1)

        analytics_result = AnalyticsResult(
            run_id=run.id,
            row_num=row_num,
            record_id=record_id,
            category=category,
            risk_score=float(risk_score),
            ae_error=float(ae_error),
            if_score=float(if_score),
        )
        db.add(analytics_result)
        run.stored_result_rows = int(run.stored_result_rows or 0) + 1
        run.result_storage_mode = "all" if int(run.stored_result_rows or 0) >= int(run.total_records or 0) else "limited"

    event = LiveStreamEvent(
        upload_id=upload_id,
        run_id=run_id,
        source=source,
        row_num=row_num,
        record_id=record_id,
        category=category,
        risk_score=float(risk_score),
        ae_error=float(ae_error),
        if_score=float(if_score),
        payload=payload,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def replace_live_stream_snapshot(
    db: Session,
    upload_id: int | None,
    run_id: int | None,
    events: list[dict],
) -> None:
    if run_id is None:
        return

    db.query(LiveStreamEvent).filter(
        LiveStreamEvent.run_id == run_id,
        LiveStreamEvent.source == "csv-analytics",
    ).delete(synchronize_session=False)

    db.bulk_save_objects(
        [
            LiveStreamEvent(
                upload_id=upload_id,
                run_id=run_id,
                source="csv-analytics",
                row_num=int(event.get("row_num") or 0),
                record_id=str(event.get("record_id") or ""),
                category=str(event.get("category") or "unknown"),
                risk_score=float(event.get("risk_score") or 0.0),
                ae_error=float(event.get("ae_error") or 0.0),
                if_score=float(event.get("if_score") or 0.0),
                payload=dict(event.get("row_data") or {}),
            )
            for event in events
        ]
    )
    db.commit()
