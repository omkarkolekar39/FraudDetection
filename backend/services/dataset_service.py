import re
from typing import Any

import numpy as np
import pandas as pd


IDENTIFIER_HINT_PATTERN = re.compile(
    r"(^id$|_id$|^id_|account|transaction|txn|customer|reference|ref(?:_|)?number|record(?:_|)?number|case(?:_|)?number|serial|sr(?:_|)?no|index|row(?:_|)?num|row(?:_|)?number|uuid|guid|unnamed)",
    re.IGNORECASE,
)
SERIAL_RECORD_PATTERN = re.compile(r"^record\s*([0-9]+)$", re.IGNORECASE)


def _normalize_column_name(column_name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(column_name).strip().lower()).strip("_")


def _looks_like_exported_index(series: pd.Series) -> bool:
    numeric_series = pd.to_numeric(series, errors="coerce")
    if numeric_series.empty or numeric_series.isna().any():
        return False

    values = numeric_series.to_numpy(dtype=float)
    if not np.allclose(values, np.round(values)):
        return False

    int_values = values.astype(int)
    zero_based = np.arange(len(int_values))
    one_based = np.arange(1, len(int_values) + 1)
    return np.array_equal(int_values, zero_based) or np.array_equal(int_values, one_based)


def is_identifier_column(column_name: str, series: pd.Series) -> bool:
    normalized_name = _normalize_column_name(column_name)

    if IDENTIFIER_HINT_PATTERN.search(normalized_name):
        return True

    if _looks_like_exported_index(series):
        return True

    row_count = len(series)
    if row_count == 0:
        return False

    unique_count = series.nunique(dropna=True)
    unique_ratio = unique_count / row_count
    numeric_series = pd.to_numeric(series, errors="coerce")
    numeric_ratio = float(numeric_series.notna().mean())

    if unique_ratio >= 0.98 and any(token in normalized_name for token in ("number", "code", "index", "serial", "row")):
        return True

    if numeric_ratio >= 0.95 and unique_ratio >= 0.98:
        valid_numbers = numeric_series.dropna()
        if (
            not valid_numbers.empty
            and np.allclose(valid_numbers % 1, 0)
            and valid_numbers.is_monotonic_increasing
            and any(token in normalized_name for token in ("id", "number", "code", "index", "serial", "row", "account", "customer", "txn"))
        ):
            return True

    if normalized_name.startswith("unnamed") and unique_ratio >= 0.98:
        return True

    return False


def detect_identifier_columns(df: pd.DataFrame) -> list[str]:
    return [column for column in df.columns if is_identifier_column(column, df[column])]


def build_numeric_analysis_frame(
    df: pd.DataFrame,
    ignored_columns: list[str] | None = None,
) -> tuple[pd.DataFrame, list[str], list[str]]:
    id_columns = detect_identifier_columns(df)
    ignored_set = {column for column in (ignored_columns or []) if column in df.columns}
    numeric_candidates: dict[str, pd.Series] = {}

    for column in df.columns:
        if column in ignored_set:
            continue

        coerced = pd.to_numeric(df[column], errors="coerce")
        if coerced.notna().sum() == 0:
            continue

        # Preserve true numeric columns even after CSV sanitation converts some cells to strings.
        if float(coerced.notna().mean()) < 0.5:
            continue

        numeric_candidates[column] = coerced

    numeric_df = pd.DataFrame(numeric_candidates, index=df.index)
    analysis_columns = list(numeric_df.columns)

    if not analysis_columns:
        raise ValueError(
            "The uploaded CSV contains no analyzable numeric columns after excluding identifier fields."
        )

    return numeric_df[analysis_columns].copy(), id_columns, analysis_columns


def get_primary_identifier_column(df: pd.DataFrame, id_columns: list[str] | None = None) -> str | None:
    detected = id_columns or detect_identifier_columns(df)
    return detected[0] if detected else None


def get_serial_record_id(row_position: int) -> str:
    return f"RECORD {row_position + 1}"


def get_display_identifier(df: pd.DataFrame, row_position: int, id_columns: list[str] | None = None) -> str:
    return get_serial_record_id(row_position)


def _parse_serial_lookup(lookup_text: str) -> int | None:
    match = SERIAL_RECORD_PATTERN.fullmatch(lookup_text)
    if match:
        return int(match.group(1))

    return None


def _parse_numeric_lookup(lookup_text: str) -> int | None:
    try:
        return int(float(lookup_text))
    except (TypeError, ValueError):
        return None


def resolve_record_lookup(
    df: pd.DataFrame,
    lookup_value: Any,
    id_columns: list[str] | None = None,
) -> tuple[int, Any, str]:
    resolved_columns = id_columns or detect_identifier_columns(df)
    lookup_text = str(lookup_value).strip()
    record_number = _parse_serial_lookup(lookup_text)

    if record_number is not None and 1 <= record_number <= len(df):
        row_position = record_number - 1
        return row_position, df.index[row_position], get_display_identifier(df, row_position, resolved_columns)

    for column in resolved_columns:
        mask = df[column].astype(str).str.strip() == lookup_text
        if mask.any():
            row_position = int(np.where(mask)[0][0])
            return row_position, df.index[row_position], get_display_identifier(df, row_position, resolved_columns)

    record_number = _parse_numeric_lookup(lookup_text)

    if record_number is not None and 1 <= record_number <= len(df):
        row_position = record_number - 1
        return row_position, df.index[row_position], get_display_identifier(df, row_position, resolved_columns)

    if record_number is not None and record_number in df.index:
        row_position = int(df.index.get_loc(record_number))
        return row_position, record_number, get_display_identifier(df, row_position, resolved_columns)

    raise ValueError(f"Record '{lookup_value}' was not found in the current dataset.")


def sanitize_record(record: dict[str, Any]) -> dict[str, Any]:
    clean_record: dict[str, Any] = {}
    for key, value in record.items():
        if isinstance(value, (np.generic,)):
            value = value.item()
        if pd.isna(value):
            clean_record[key] = ""
        else:
            clean_record[key] = value
    return clean_record
