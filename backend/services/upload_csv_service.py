import pandas as pd
import io
import numpy as np
from services.dataset_service import detect_identifier_columns
from services.analytics_runner_service import execute_ml_pipeline


def _save_active_watch_file(request, contents: bytes, filename: str | None) -> str | None:
    service = getattr(request.app.state, "csv_watch_service", None)
    if service is None:
        return None

    return service.save_and_watch(contents, filename)


def _has_ready_live_models(app) -> bool:
    return (
        getattr(app.state, "raw_df", None) is not None
        and getattr(app.state, "scaler", None) is not None
        and getattr(app.state, "if_model", None) is not None
        and getattr(app.state, "ae_model", None) is not None
    )


def _is_append_of_current_dataset(current_df: pd.DataFrame, uploaded_df: pd.DataFrame) -> bool:
    if list(current_df.columns) != list(uploaded_df.columns):
        return False

    if len(uploaded_df) <= len(current_df):
        return False

    uploaded_prefix = uploaded_df.iloc[:len(current_df)].reset_index(drop=True).astype(str)
    current_prefix = current_df.reset_index(drop=True).astype(str)
    return uploaded_prefix.equals(current_prefix)


def _is_same_current_dataset(current_df: pd.DataFrame, uploaded_df: pd.DataFrame) -> bool:
    if list(current_df.columns) != list(uploaded_df.columns):
        return False

    if len(uploaded_df) != len(current_df):
        return False

    return uploaded_df.reset_index(drop=True).astype(str).equals(
        current_df.reset_index(drop=True).astype(str)
    )


def _sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    return df.replace([np.inf, -np.inf], np.nan).fillna("N/A")


def _read_csv_contents(contents: bytes) -> pd.DataFrame:
    chunk_size = 10000
    reader = pd.read_csv(io.BytesIO(contents), chunksize=chunk_size)
    chunks = []

    for chunk in reader:
        if chunk.empty:
            continue
        chunks.append(_sanitize_dataframe(chunk))

    if not chunks:
        raise ValueError("Uploaded CSV is empty or invalid.")

    return pd.concat(chunks, ignore_index=True)


def _build_metadata(df: pd.DataFrame, ignored_columns: list[str] | None = None) -> dict:
    ignored_columns = [column for column in (ignored_columns or []) if column in df.columns]
    detected_id_columns = detect_identifier_columns(df)
    effective_ignored = ignored_columns or detected_id_columns

    return {
        "total_records": int(len(df)),
        "total_columns": int(len(df.columns)),
        "column_names": list(df.columns),
        "locked_ignored_columns": detected_id_columns,
        "ignored_columns": effective_ignored,
        "analyzed_columns": [column for column in df.columns if column not in effective_ignored],
        "preview_data": df.head(12).to_dict(orient="records"),
    }


def process_csv_contents(request, contents: bytes, filename: str | None, uploaded_by: str, user_ignored_columns=None):
    ignored_columns = list(user_ignored_columns or [])
    uploaded_df = _read_csv_contents(contents)
    current_df = getattr(request.app.state, "raw_df", None)
    request.app.state.user_ignored_columns = ignored_columns

    if current_df is not None and _has_ready_live_models(request.app):
        from services.live_stream_service import get_live_stream_status

        if _is_same_current_dataset(current_df, uploaded_df):
            return {
                "status": "success",
                "incremental": True,
                "new_rows": [],
                "total_records": int(len(current_df)),
                "columns_detected": list(current_df.columns),
                "summary_stats": {},
                "metadata": _build_metadata(current_df, ignored_columns),
                "live_stream": get_live_stream_status(request.app),
            }

        if _is_append_of_current_dataset(current_df, uploaded_df):
            from services.live_stream_service import score_stream_row

            appended_df = uploaded_df.iloc[len(current_df):].reset_index(drop=True)
            scored_rows = [
                score_stream_row(
                    request.app,
                    {
                        "row_data": row.to_dict(),
                        "source": "csv-upload-append",
                        "operator": uploaded_by,
                    },
                    source="csv-upload-append",
                )
                for _, row in appended_df.iterrows()
            ]

            return {
                "status": "success",
                "incremental": True,
                "new_rows": scored_rows,
                "total_records": int(len(getattr(request.app.state, "raw_df", uploaded_df))),
                "columns_detected": list(uploaded_df.columns),
                "summary_stats": {},
                "metadata": _build_metadata(getattr(request.app.state, "raw_df", uploaded_df), ignored_columns),
                "live_stream": get_live_stream_status(request.app),
            }

    request.app.state.raw_df = uploaded_df
    request.app.state.live_stream_events = []
    request.app.state.live_stream_last_result = None
    request.app.state.live_stream_last_message_at = None

    analytics = execute_ml_pipeline(request, None, uploaded_by)
    request.app.state.live_stream_ready = True

    from services.live_stream_service import get_live_stream_status

    return {
        "status": "success",
        "incremental": False,
        "upload_id": None,
        "total_records": int(len(uploaded_df)),
        "columns_detected": list(uploaded_df.columns),
        "summary_stats": {},
        "metadata": _build_metadata(uploaded_df, ignored_columns),
        "analytics": analytics,
        "live_stream": get_live_stream_status(request.app),
    }


async def process_uploaded_csv(request, db, file, uploaded_by: str, user_ignored_columns=None, auto_analyze: bool = True):
    contents = await file.read()
    return process_csv_contents(
        request,
        contents,
        getattr(file, "filename", None),
        uploaded_by,
        user_ignored_columns,
    )
