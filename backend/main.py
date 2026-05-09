from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError
import uvicorn

from config.db_config import engine

from api.login_api import router as login_router
from api.register_api import router as register_router
from api.upload_csv_api import router as upload_router
from api.live_stream_api import router as live_stream_router
from api.set_thresholds_api import router as threshold_router
from api.run_analytics_api import router as analytics_router
from api.get_dashboard_stats_api import router as dash_stats_router
from api.get_graphs_data_api import router as graphs_router
from api.get_risk_directory_api import router as directory_router
from api.get_customer_360_api import router as customer_router
from api.get_pending_approvals_api import router as approvals_router
from api.approve_analyst_api import router as approve_router
from api.reject_analyst_api import router as reject_router
from api.get_notifications_api import router as notify_router
from api.get_audit_logs_api import router as audit_router
from api.manage_users_api import router as manage_users_router
from api.execute_action_api import router as action_router
from api.change_password_api import router as password_router
from api.get_xai_shap_api import router as xai_router
from services.live_stream_service import KafkaLiveStreamService, initialize_live_stream_state, register_live_stream_loop
from services.csv_watch_service import CsvWatchService, initialize_csv_watch_state

REQUIRED_SUPABASE_TABLES = (
    "users",
    "audit_logs",
    "notifications",
    "risk_settings",
    "dataset_uploads",
    "analytics_runs",
    "analytics_results",
    "business_actions",
    "live_stream_events",
)


def get_missing_supabase_tables() -> list[str]:
    db_inspector = inspect(engine)
    return [
        table_name
        for table_name in REQUIRED_SUPABASE_TABLES
        if not db_inspector.has_table(table_name, schema="public")
    ]

app = FastAPI(
    title="FraudDetectAI Production",
    version="1.0.0",
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Runtime state used by the CSV and live-stream screens.
app.state.raw_df = None
app.state.categories = []
app.state.scores = []
app.state.ae_errors = []
app.state.if_scores = []
app.state.thresholds = {"high": 70.0, "medium": 30.0}
app.state.last_run = "Never"
app.state.numeric_df = None
app.state.data_norm = None
app.state.scaler = None
app.state.ae_model = None
app.state.if_model = None
app.state.id_columns = []
app.state.user_ignored_columns = []
app.state.ignored_columns = []
app.state.analysis_columns = []
app.state.score_scaling = {}
app.state.global_feature_impacts = []
app.state.active_upload_id = None
app.state.active_run_id = None
app.state.result_row_nums = []
app.state.persisted_summary = None
app.state.persisted_sample_only = False
initialize_live_stream_state(app)
initialize_csv_watch_state(app)
app.state.database_schema_error = None


@app.middleware("http")
async def require_manual_supabase_schema(request: Request, call_next):
    if request.url.path.startswith("/api") and request.url.path != "/api/health":
        schema_error = getattr(request.app.state, "database_schema_error", None)
        if schema_error:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": schema_error,
                    "missing_tables": getattr(request.app.state, "missing_supabase_tables", []),
                    "schema_file": "supabase_schema.sql",
                },
            )

    return await call_next(request)

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "database_schema": "missing" if app.state.database_schema_error else "ready",
        "database_schema_error": app.state.database_schema_error,
        "missing_supabase_tables": getattr(app.state, "missing_supabase_tables", []),
        "neural_buffer": "active" if app.state.raw_df is not None else "empty",
        "last_analytics_run": app.state.last_run
    }

app.include_router(login_router, prefix="/api/auth", tags=["Auth"])
app.include_router(register_router, prefix="/api/auth", tags=["Auth"])

app.include_router(upload_router, prefix="/api/data", tags=["Data"])
app.include_router(live_stream_router, prefix="/api/data", tags=["Data"])
app.include_router(threshold_router, prefix="/api/data", tags=["Data"])

app.include_router(analytics_router, prefix="/api/ml", tags=["ML Engine"])

app.include_router(graphs_router, prefix="/api/stats", tags=["Visuals"])
app.include_router(dash_stats_router, prefix="/api/dashboard", tags=["Dashboard Stats"])

app.include_router(directory_router, prefix="/api/directory", tags=["Risk Search"])
app.include_router(customer_router, prefix="/api/investigation", tags=["Customer 360"])

app.include_router(xai_router, prefix="/api/xai", tags=["XAI"])

app.include_router(approvals_router, prefix="/api/admin", tags=["User Admin"])
app.include_router(approve_router, prefix="/api/admin", tags=["User Admin"])
app.include_router(reject_router, prefix="/api/admin", tags=["User Admin"])
app.include_router(audit_router, prefix="/api/admin", tags=["Audit Logs"])
app.include_router(manage_users_router, prefix="/api/admin", tags=["User Admin"])

app.include_router(action_router, prefix="/api/actions", tags=["Actions"])

app.include_router(notify_router, prefix="/api/notifications", tags=["System Events"])
app.include_router(password_router, prefix="/api/profile", tags=["Profile"])

@app.get("/")
def root():
    return {"message": "FraudDetectAI API is Online"}


@app.on_event("startup")
async def startup_live_stream_service():
    try:
        missing_tables = get_missing_supabase_tables()
    except SQLAlchemyError as error:
        app.state.missing_supabase_tables = list(REQUIRED_SUPABASE_TABLES)
        app.state.database_schema_error = (
            "Could not inspect the Supabase database schema. Confirm SUPABASE_DB_URL is correct, "
            f"then run supabase_schema.sql in the Supabase SQL editor. Database error: {error}"
        )
        return

    app.state.missing_supabase_tables = missing_tables
    if missing_tables:
        app.state.database_schema_error = (
            "Supabase database schema is not installed. Missing table(s): "
            f"{', '.join(missing_tables)}. Run supabase_schema.sql in the Supabase SQL editor."
        )
        return

    app.state.database_schema_error = None
    register_live_stream_loop(app)
    service = KafkaLiveStreamService(app)
    app.state.kafka_live_stream_service = service
    service.start()
    app.state.csv_watch_service = CsvWatchService(app)


@app.on_event("shutdown")
def shutdown_live_stream_service():
    service = getattr(app.state, "kafka_live_stream_service", None)
    if service is not None:
        service.stop()
    csv_service = getattr(app.state, "csv_watch_service", None)
    if csv_service is not None:
        csv_service.stop()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        workers=1
    )
