from __future__ import annotations

from pathlib import Path
import threading
import time
from typing import Any

import numpy as np
import pandas as pd

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except Exception:  # pragma: no cover - app still works if dependency is missing
    FileSystemEventHandler = None
    Observer = None


WATCH_DIR = Path(__file__).resolve().parents[1] / "runtime" / "watched_csv"
ACTIVE_CSV_NAME = "active_dataset.csv"


def _sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    return df.replace([np.inf, -np.inf], np.nan).fillna("N/A")


def _same_columns(left: pd.DataFrame, right: pd.DataFrame) -> bool:
    return list(left.columns) == list(right.columns)


def _matches_existing_prefix(current_df: pd.DataFrame, updated_df: pd.DataFrame) -> bool:
    if not _same_columns(current_df, updated_df):
        return False

    if len(updated_df) < len(current_df):
        return False

    current_prefix = current_df.reset_index(drop=True).astype(str)
    updated_prefix = updated_df.iloc[:len(current_df)].reset_index(drop=True).astype(str)
    return updated_prefix.equals(current_prefix)


class _CsvChangeHandler(FileSystemEventHandler):
    def __init__(self, service: "CsvWatchService"):
        self.service = service

    def on_modified(self, event) -> None:
        if event.is_directory:
            return
        self.service.handle_possible_change(Path(event.src_path))

    def on_created(self, event) -> None:
        if event.is_directory:
            return
        self.service.handle_possible_change(Path(event.src_path))


class CsvWatchService:
    def __init__(self, app):
        self.app = app
        self.watch_path = WATCH_DIR / ACTIVE_CSV_NAME
        self.original_filename = None
        self.processed_row_count = 0
        self._observer = None
        self._lock = threading.Lock()
        self._last_event_at = 0.0

    def save_and_watch(self, contents: bytes, filename: str | None = None) -> str:
        WATCH_DIR.mkdir(parents=True, exist_ok=True)
        self.watch_path.write_bytes(contents)
        self.original_filename = filename or ACTIVE_CSV_NAME
        current_df = getattr(self.app.state, "raw_df", None)
        self.processed_row_count = len(current_df) if current_df is not None else 0
        self.app.state.watched_csv_path = str(self.watch_path)
        self.app.state.watched_csv_original_filename = self.original_filename
        self.app.state.watched_csv_row_count = self.processed_row_count
        self.start()
        return str(self.watch_path)

    def watch_existing_file(self, csv_path: str) -> str:
        resolved_path = Path(csv_path).expanduser().resolve()
        if not resolved_path.exists():
            raise FileNotFoundError(f"CSV file was not found: {resolved_path}")

        self.watch_path = resolved_path
        self.original_filename = resolved_path.name
        current_df = getattr(self.app.state, "raw_df", None)
        self.processed_row_count = len(current_df) if current_df is not None else 0
        self.app.state.watched_csv_path = str(self.watch_path)
        self.app.state.watched_csv_original_filename = self.original_filename
        self.app.state.watched_csv_row_count = self.processed_row_count
        self.start()
        return str(self.watch_path)

    def start(self) -> None:
        if Observer is None or FileSystemEventHandler is None:
            self.app.state.csv_watch_enabled = False
            self.app.state.csv_watch_last_error = "Install watchdog to enable automatic CSV file monitoring."
            return

        self.stop()
        self._observer = Observer()
        self._observer.schedule(_CsvChangeHandler(self), str(self.watch_path.parent), recursive=False)
        self._observer.daemon = True
        self._observer.start()
        self.app.state.csv_watch_enabled = True
        self.app.state.csv_watch_last_error = None

    def stop(self) -> None:
        if self._observer is None:
            return

        self._observer.stop()
        self._observer.join(timeout=2.0)
        self._observer = None

    def handle_possible_change(self, changed_path: Path) -> None:
        if changed_path.resolve() != self.watch_path.resolve():
            return

        now = time.time()
        if now - self._last_event_at < 0.4:
            return

        self._last_event_at = now
        threading.Thread(target=self.process_new_rows, daemon=True).start()

    def process_new_rows(self) -> list[dict[str, Any]]:
        with self._lock:
            time.sleep(0.25)
            try:
                if not self.watch_path.exists():
                    return []

                current_df = getattr(self.app.state, "raw_df", None)
                if current_df is None:
                    self.app.state.csv_watch_last_error = "Upload and analyze a CSV before file monitoring can score new rows."
                    return []

                updated_df = _sanitize_dataframe(pd.read_csv(self.watch_path))
                if len(updated_df) <= len(current_df):
                    self.processed_row_count = len(updated_df)
                    self.app.state.watched_csv_row_count = self.processed_row_count
                    return []

                if not _matches_existing_prefix(current_df, updated_df):
                    self.app.state.csv_watch_last_error = (
                        "The watched CSV changed existing rows or columns. Append-only changes are required for live scoring."
                    )
                    return []

                from services.live_stream_service import score_stream_row

                new_rows = []
                appended_df = updated_df.iloc[len(current_df):].reset_index(drop=True)
                for _, row in appended_df.iterrows():
                    new_rows.append(
                        score_stream_row(
                            self.app,
                            {
                                "row_data": row.to_dict(),
                                "source": "csv-file-watch",
                                "operator": "csv-watcher",
                            },
                            source="csv-file-watch",
                        )
                    )

                self.processed_row_count = len(getattr(self.app.state, "raw_df", updated_df))
                self.app.state.watched_csv_row_count = self.processed_row_count
                self.app.state.csv_watch_last_error = None
                return new_rows
            except Exception as error:
                self.app.state.csv_watch_last_error = str(error)
                return []


def initialize_csv_watch_state(app) -> None:
    app.state.csv_watch_enabled = False
    app.state.csv_watch_last_error = None
    app.state.watched_csv_path = None
    app.state.watched_csv_original_filename = None
    app.state.watched_csv_row_count = 0
