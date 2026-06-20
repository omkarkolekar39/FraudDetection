from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from config.db_config import Base


class RiskSetting(Base):
    __tablename__ = "risk_settings"

    id = Column(Integer, primary_key=True, default=1)
    high_threshold = Column(Float, nullable=False, default=70.0)
    medium_threshold = Column(Float, nullable=False, default=30.0)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DatasetUpload(Base):
    __tablename__ = "dataset_uploads"

    id = Column(BigInteger, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_by = Column(String, nullable=False)
    total_records = Column(Integer, nullable=False, default=0)
    columns_detected = Column(JSONB, nullable=False, default=list)
    ignored_columns = Column(JSONB, nullable=False, default=list)
    id_columns = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AnalyticsRun(Base):
    __tablename__ = "analytics_runs"

    id = Column(BigInteger, primary_key=True, index=True)
    upload_id = Column(BigInteger, ForeignKey("dataset_uploads.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by = Column(String, nullable=False)
    high_threshold = Column(Float, nullable=False)
    medium_threshold = Column(Float, nullable=False)
    total_records = Column(Integer, nullable=False, default=0)
    high_risk_count = Column(Integer, nullable=False, default=0)
    medium_risk_count = Column(Integer, nullable=False, default=0)
    low_risk_count = Column(Integer, nullable=False, default=0)
    ae_avg_pct = Column(Float, nullable=False, default=0.0)
    if_avg_pct = Column(Float, nullable=False, default=0.0)
    score_scaling = Column(JSONB, nullable=False, default=dict)
    global_feature_impacts = Column(JSONB, nullable=False, default=list)
    analysis_columns = Column(JSONB, nullable=False, default=list)
    id_columns = Column(JSONB, nullable=False, default=list)
    ignored_columns = Column(JSONB, nullable=False, default=list)
    status = Column(String, nullable=False, default="completed")
    result_storage_mode = Column(String, nullable=False, default="all")
    stored_result_rows = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AnalyticsResult(Base):
    __tablename__ = "analytics_results"

    id = Column(BigInteger, primary_key=True, index=True)
    run_id = Column(BigInteger, ForeignKey("analytics_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_num = Column(Integer, nullable=False)
    record_id = Column(String, nullable=False)
    category = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False, default=0.0)
    ae_error = Column(Float, nullable=False, default=0.0)
    if_score = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BusinessAction(Base):
    __tablename__ = "business_actions"

    id = Column(BigInteger, primary_key=True, index=True)
    record_id = Column(String, nullable=False, index=True)
    action_type = Column(String, nullable=False)
    executed_by = Column(String, nullable=False)
    executed_by_role = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LiveStreamEvent(Base):
    __tablename__ = "live_stream_events"

    id = Column(BigInteger, primary_key=True, index=True)
    upload_id = Column(BigInteger, ForeignKey("dataset_uploads.id", ondelete="SET NULL"), nullable=True, index=True)
    run_id = Column(BigInteger, ForeignKey("analytics_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    source = Column(String, nullable=False, default="kafka")
    record_id = Column(String, nullable=False)
    row_num = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False, default=0.0)
    ae_error = Column(Float, nullable=False, default=0.0)
    if_score = Column(Float, nullable=False, default=0.0)
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
