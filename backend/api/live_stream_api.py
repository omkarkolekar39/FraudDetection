from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect

from schemas.live_stream_schema import LiveStreamRowRequest
from services.live_stream_service import (
    connect_live_stream_client,
    disconnect_live_stream_client,
    get_live_stream_status,
    score_stream_row,
)
from services.login_service import get_current_user

router = APIRouter()


@router.get("/live-stream/status")
def fetch_live_stream_status(request: Request, current_user=Depends(get_current_user)):
    if current_user.role not in {"Admin", "Analyst"}:
        raise HTTPException(status_code=403, detail="Only Admin or Analyst users can view live stream status.")

    return get_live_stream_status(request.app)


@router.post("/live-stream/watch-file")
async def watch_existing_csv_file(
    request: Request,
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"Admin", "Analyst"}:
        raise HTTPException(status_code=403, detail="Only Admin or Analyst users can watch CSV files.")

    payload = await request.json()
    csv_path = str(payload.get("path") or "").strip()
    if not csv_path:
        raise HTTPException(status_code=400, detail="CSV file path is required.")

    service = getattr(request.app.state, "csv_watch_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="CSV watch service is not available.")

    try:
        watched_path = service.watch_existing_file(csv_path)
        return {
            "status": "watching",
            "path": watched_path,
            "live_stream": get_live_stream_status(request.app),
        }
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to watch CSV file: {error}")


@router.websocket("/live-stream/ws")
async def live_stream_websocket(websocket: WebSocket):
    try:
        await websocket.accept()
        app = websocket.scope["app"]
        await connect_live_stream_client(app, websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        disconnect_live_stream_client(app, websocket)
    except Exception as e:
        # Log error, but do not print stack trace to terminal
        try:
            await websocket.close()
        except Exception:
            pass
        # Optionally, log to a file or monitoring system
        # print(f"WebSocket error: {e}")


@router.post("/live-stream/publish")
def publish_live_stream_row(
    payload: LiveStreamRowRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    if current_user.role not in {"Admin", "Analyst"}:
        raise HTTPException(status_code=403, detail="Only Admin or Analyst users can publish live rows.")

    try:
        result = score_stream_row(
            request.app,
            {
                "row_data": payload.row_data,
                "source": payload.source,
                "operator": current_user.username,
            },
            source=payload.source,
        )
        return {
            "status": "processed",
            "transport": "direct",
            "event": result,
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to publish live row: {error}")
