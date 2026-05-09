from __future__ import annotations

import asyncio
from datetime import datetime
import json
import math
import os
import threading
import time
from typing import Any

import numpy as np
import pandas as pd
import torch

from ml_engine.risk_blender import calculate_single_blended_risk
from services.dataset_service import get_serial_record_id

try:
    from kafka import KafkaConsumer, KafkaProducer
except Exception:  # pragma: no cover - keeps startup resilient if dependency is absent
    KafkaConsumer = None
    KafkaProducer = None


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "").strip()
KAFKA_LIVE_TOPIC = os.getenv("KAFKA_LIVE_TOPIC", "fraud-live-rows").strip()
KAFKA_LIVE_GROUP_ID = os.getenv("KAFKA_LIVE_GROUP_ID", "frauddetectai-live-workers").strip()
LIVE_EVENT_HISTORY_LIMIT = int(os.getenv("LIVE_EVENT_HISTORY_LIMIT", "12"))


def _json_safe(value: Any) -> Any:
    if isinstance(value, (np.generic,)):
        return value.item()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def initialize_live_stream_state(app) -> None:
    app.state.live_stream_events = []
    app.state.live_stream_last_error = None
    app.state.live_stream_last_message_at = None
    app.state.live_stream_last_result = None
    app.state.live_stream_enabled = True
    app.state.live_stream_topic = KAFKA_LIVE_TOPIC
    app.state.live_stream_ready = False
    app.state.live_stream_transport = "direct"
    if not hasattr(app.state, "live_stream_clients"):
        app.state.live_stream_clients = set()
    if not hasattr(app.state, "live_stream_loop"):
        app.state.live_stream_loop = None


def register_live_stream_loop(app) -> None:
    app.state.live_stream_loop = asyncio.get_running_loop()


async def connect_live_stream_client(app, websocket) -> None:
    app.state.live_stream_clients.add(websocket)
    try:
        await websocket.send_json({
            "type": "snapshot",
            "payload": get_live_stream_status(app),
        })
    except Exception:
        # Suppress WebSocketDisconnect and other send errors
        pass


def disconnect_live_stream_client(app, websocket) -> None:
    clients = getattr(app.state, "live_stream_clients", set())
    clients.discard(websocket)
    app.state.live_stream_clients = clients


async def _send_live_stream_payload(app, payload: dict[str, Any]) -> None:
    clients = list(getattr(app.state, "live_stream_clients", set()))
    stale_clients = []

    for websocket in clients:
        try:
            await websocket.send_json(payload)
        except Exception:
            stale_clients.append(websocket)

    for websocket in stale_clients:
        disconnect_live_stream_client(app, websocket)


def _schedule_live_stream_payload(app, payload: dict[str, Any]) -> None:
    loop = getattr(app.state, "live_stream_loop", None)
    clients = getattr(app.state, "live_stream_clients", set())
    if loop is None or not clients:
        return

    try:
        loop.call_soon_threadsafe(
            lambda: asyncio.create_task(_send_live_stream_payload(app, payload))
        )
    except RuntimeError:
        pass


def _append_live_event(app, event_payload: dict[str, Any]) -> None:
    existing = list(getattr(app.state, "live_stream_events", []))
    existing.insert(0, event_payload)
    app.state.live_stream_events = existing[:LIVE_EVENT_HISTORY_LIMIT]
    app.state.live_stream_last_result = event_payload
    app.state.live_stream_last_message_at = event_payload.get("timestamp")
    _schedule_live_stream_payload(
        app,
        {
            "type": "live_row",
            "payload": event_payload,
            "status": get_live_stream_status(app),
        },
    )


def _build_scored_event(
    app,
    row_index: int,
    source: str,
    operator: str,
    timestamp: str | None = None,
) -> dict[str, Any]:
    raw_df = getattr(app.state, "raw_df", None)
    if raw_df is None or row_index >= len(raw_df):
        raise ValueError("Cannot build a live stream event without a scored dataset row.")

    row_num = row_index + 1
    row_payload = {
        column: _json_safe(raw_df.iloc[row_index].get(column))
        for column in raw_df.columns
    }

    categories = list(getattr(app.state, "categories", []))
    scores = list(getattr(app.state, "scores", []))
    ae_errors = list(getattr(app.state, "ae_errors", []))
    if_scores = list(getattr(app.state, "if_scores", []))

    return {
        "record_id": get_serial_record_id(row_index),
        "row_num": row_num,
        "category": str(categories[row_index]).replace(" Risk", "").lower().strip() if row_index < len(categories) else "unknown",
        "risk_score": round(float(scores[row_index]), 2) if row_index < len(scores) else 0.0,
        "ae_error": round(float(ae_errors[row_index]), 6) if row_index < len(ae_errors) else 0.0,
        "if_score": round(float(if_scores[row_index]), 6) if row_index < len(if_scores) else 0.0,
        "source": source,
        "operator": operator,
        "timestamp": timestamp or datetime.utcnow().isoformat(),
        "row_data": row_payload,
    }


def sync_live_stream_events_from_current_state(app, source: str = "csv-upload", operator: str = "analytics") -> None:
    raw_df = getattr(app.state, "raw_df", None)
    scores = list(getattr(app.state, "scores", []))
    if raw_df is None or not scores:
        app.state.live_stream_events = []
        app.state.live_stream_last_result = None
        app.state.live_stream_last_message_at = None
        app.state.live_stream_ready = False
        return

    total_rows = min(len(raw_df), len(scores))
    timestamp = datetime.utcnow().isoformat()
    events = [
        _build_scored_event(app, row_index, source=source, operator=operator, timestamp=timestamp)
        for row_index in range(0, total_rows)
    ]
    events.reverse()

    app.state.live_stream_events = events
    app.state.live_stream_last_result = events[0] if events else None
    app.state.live_stream_last_message_at = timestamp if events else None
    app.state.live_stream_last_error = None
    app.state.live_stream_ready = True


def _current_operator(app) -> str:
    recent = getattr(app.state, "live_stream_last_result", None)
    if recent and recent.get("operator"):
        return str(recent["operator"])
    return "kafka-stream"


def score_stream_row(app, payload: dict[str, Any], source: str = "kafka") -> dict[str, Any]:
    if getattr(app.state, "raw_df", None) is None:
        raise ValueError("Upload a dataset before sending live rows.")
    if getattr(app.state, "scaler", None) is None or getattr(app.state, "if_model", None) is None or getattr(app.state, "ae_model", None) is None:
        raise ValueError("Run the analytics pipeline before sending live rows.")

    raw_df = app.state.raw_df
    row_data = payload.get("row_data", {})
    operator = str(payload.get("operator") or payload.get("source") or source)

    full_row = {column: row_data.get(column, None) for column in raw_df.columns}
    sanitized_row = {
        column: ("N/A" if value is None else _json_safe(value))
        for column, value in full_row.items()
    }
    appended_frame = pd.DataFrame([sanitized_row], columns=raw_df.columns)

    analysis_columns = list(getattr(app.state, "analysis_columns", []))
    row_features = pd.DataFrame(
        [{column: row_data.get(column, appended_frame.iloc[0].get(column)) for column in analysis_columns}],
        columns=analysis_columns,
    )
    row_features = row_features.apply(pd.to_numeric, errors="coerce").fillna(0.0)
    scaled_row = app.state.scaler.transform(row_features.values)[0]

    app.state.ae_model.eval()
    with torch.no_grad():
        tensor_row = torch.FloatTensor([scaled_row])
        reconstructed = app.state.ae_model(tensor_row)
        ae_error = torch.mean((reconstructed - tensor_row) ** 2, dim=1).item()

    if_score = float(-app.state.if_model.decision_function([scaled_row])[0])
    blended_score, blended_category = calculate_single_blended_risk(
        ae_error,
        if_score,
        getattr(app.state, "score_scaling", {}),
        getattr(app.state, "thresholds", {}).get("high", 70.0),
        getattr(app.state, "thresholds", {}).get("medium", 30.0),
    )

    category = str(blended_category).replace(" Risk", "").lower().strip()
    row_num = len(app.state.scores) + 1
    record_id = get_serial_record_id(row_num - 1)

    app.state.raw_df = pd.concat([raw_df, appended_frame], ignore_index=True)
    if getattr(app.state, "numeric_df", None) is not None:
        app.state.numeric_df = pd.concat([app.state.numeric_df, row_features], ignore_index=True)
    if getattr(app.state, "data_norm", None) is not None:
        app.state.data_norm = np.vstack([app.state.data_norm, scaled_row])

    app.state.ae_errors.append(float(ae_error))
    app.state.if_scores.append(float(if_score))
    app.state.scores.append(float(blended_score))
    app.state.categories.append(category)
    app.state.result_row_nums.append(row_num)
    app.state.last_run = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    app.state.live_stream_ready = True

    score_scaling = dict(getattr(app.state, "score_scaling", {}))
    score_scaling["ae_min"] = min(float(score_scaling.get("ae_min", ae_error)), float(ae_error))
    score_scaling["ae_max"] = max(float(score_scaling.get("ae_max", ae_error)), float(ae_error))
    score_scaling["if_min"] = min(float(score_scaling.get("if_min", if_score)), float(if_score))
    score_scaling["if_max"] = max(float(score_scaling.get("if_max", if_score)), float(if_score))
    app.state.score_scaling = score_scaling

    summary = dict(getattr(app.state, "persisted_summary", {}) or {})
    summary["total_records"] = int(summary.get("total_records", len(app.state.scores) - 1)) + 1
    summary["total_high_risk"] = int(summary.get("total_high_risk", 0)) + (1 if category == "high" else 0)
    summary["total_medium_risk"] = int(summary.get("total_medium_risk", 0)) + (1 if category == "medium" else 0)
    summary["total_low_risk"] = int(summary.get("total_low_risk", 0)) + (1 if category == "low" else 0)
    summary["high_threshold"] = float(getattr(app.state, "thresholds", {}).get("high", 70.0))
    summary["medium_threshold"] = float(getattr(app.state, "thresholds", {}).get("medium", 30.0))
    summary["ae_avg_pct"] = round(float(np.mean(app.state.ae_errors)) * 100, 1) if app.state.ae_errors else 0.0
    summary["if_pct"] = round(float(np.mean(app.state.if_scores)) * 100, 1) if app.state.if_scores else 0.0
    app.state.persisted_summary = summary

    result = {
        "record_id": record_id,
        "row_num": row_num,
        "category": category,
        "risk_score": round(float(blended_score), 2),
        "ae_error": round(float(ae_error), 6),
        "if_score": round(float(if_score), 6),
        "source": source,
        "operator": operator,
        "timestamp": datetime.utcnow().isoformat(),
        "row_data": {column: _json_safe(value) for column, value in sanitized_row.items()},
    }
    _append_live_event(app, result)
    return result


def get_live_stream_status(app) -> dict[str, Any]:
    raw_df = getattr(app.state, "raw_df", None)
    events = list(getattr(app.state, "live_stream_events", []))
    score_count = len(getattr(app.state, "scores", []))

    stream_columns = list(raw_df.columns) if raw_df is not None else list(getattr(app.state, "live_stream_columns", []))
    if not stream_columns and events:
        stream_columns = list(dict.fromkeys(
            column
            for event in events
            for column in dict(event.get("row_data") or {}).keys()
        ))

    return {
        "enabled": bool(getattr(app.state, "live_stream_enabled", False)),
        "topic": getattr(app.state, "live_stream_topic", KAFKA_LIVE_TOPIC),
        "ready_for_scoring": bool(
            getattr(app.state, "raw_df", None) is not None
            and getattr(app.state, "if_model", None) is not None
            and getattr(app.state, "ae_model", None) is not None
            and getattr(app.state, "scaler", None) is not None
        ),
        "last_message_at": getattr(app.state, "live_stream_last_message_at", None),
        "last_error": getattr(app.state, "live_stream_last_error", None),
        "recent_events": events,
        "stream_columns": stream_columns,
        "total_scored_rows": max(score_count, len(events)),
        "displayed_rows": len(events),
        "history_limit": LIVE_EVENT_HISTORY_LIMIT,
        "active_upload_id": getattr(app.state, "active_upload_id", None),
        "active_run_id": getattr(app.state, "active_run_id", None),
        "transport": getattr(app.state, "live_stream_transport", "direct"),
        "csv_watch": {
            "enabled": bool(getattr(app.state, "csv_watch_enabled", False)),
            "path": getattr(app.state, "watched_csv_path", None),
            "original_filename": getattr(app.state, "watched_csv_original_filename", None),
            "row_count": int(getattr(app.state, "watched_csv_row_count", 0) or 0),
            "last_error": getattr(app.state, "csv_watch_last_error", None),
        },
    }


class KafkaLiveStreamService:
    def __init__(self, app):
        self.app = app
        self.bootstrap_servers = [server.strip() for server in KAFKA_BOOTSTRAP_SERVERS.split(",") if server.strip()]
        self.topic = KAFKA_LIVE_TOPIC
        self.group_id = KAFKA_LIVE_GROUP_ID
        self._producer = None
        self._consumer = None
        self._thread = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        initialize_live_stream_state(self.app)
        if not self.bootstrap_servers or KafkaProducer is None or KafkaConsumer is None:
            self.app.state.live_stream_enabled = True
            self.app.state.live_stream_transport = "direct"
            self.app.state.live_stream_last_error = "Kafka broker or kafka-python dependency is not configured."
            return

        try:
            self._producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            )
            self._thread = threading.Thread(target=self._consume_forever, daemon=True)
            self._thread.start()
            self.app.state.live_stream_enabled = True
            self.app.state.live_stream_transport = "kafka"
        except Exception as error:
            self.app.state.live_stream_enabled = True
            self.app.state.live_stream_transport = "direct"
            self.app.state.live_stream_last_error = str(error)

    def stop(self) -> None:
        self._stop_event.set()
        if self._consumer is not None:
            try:
                self._consumer.close()
            except Exception:
                pass
        if self._producer is not None:
            try:
                self._producer.close()
            except Exception:
                pass

    def publish(self, message: dict[str, Any]) -> dict[str, Any]:
        if self._producer is None:
            raise RuntimeError("Kafka producer is not connected. Configure KAFKA_BOOTSTRAP_SERVERS first.")

        payload = {
            "row_data": message.get("row_data", {}),
            "source": message.get("source", "manual-ui"),
            "operator": message.get("operator", _current_operator(self.app)),
            "published_at": datetime.utcnow().isoformat(),
        }
        self._producer.send(self.topic, payload)
        self._producer.flush()
        return {"status": "queued", "topic": self.topic}

    def _consume_forever(self) -> None:
        try:
            self._consumer = KafkaConsumer(
                self.topic,
                bootstrap_servers=self.bootstrap_servers,
                group_id=self.group_id,
                auto_offset_reset="latest",
                enable_auto_commit=True,
                consumer_timeout_ms=1000,
                value_deserializer=lambda value: json.loads(value.decode("utf-8")),
            )
            while not self._stop_event.is_set():
                try:
                    for message in self._consumer:
                        if self._stop_event.is_set():
                            break
                        score_stream_row(self.app, message.value, source="kafka")
                except Exception as message_error:
                    self.app.state.live_stream_last_error = str(message_error)
                    time.sleep(1.0)
        except Exception as error:
            self.app.state.live_stream_last_error = str(error)
