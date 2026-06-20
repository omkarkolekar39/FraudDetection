import json


from fastapi import APIRouter, UploadFile, File, Form, Request, Depends, HTTPException
from services.upload_csv_service import process_csv_contents
from services.login_service import get_current_user
from .job_queue import start_background_job, get_job_status

router = APIRouter()


@router.post("/upload")
async def upload_csv_to_buffer(
    request: Request,
    file: UploadFile = File(...),
    ignored_columns: str | None = Form(None),
    current_user=Depends(get_current_user)
):
    try:
        parsed_ignored_columns = json.loads(ignored_columns) if ignored_columns else []
        if not isinstance(parsed_ignored_columns, list):
            raise ValueError("ignored_columns must be a JSON array.")

        # Read file contents in async context
        contents = await file.read()
        username = current_user.username
        allow_live_stream = current_user.role in {"Admin", "Analyst"}
        app = request.app
        filename = file.filename

        def job_target():
            class DummyRequest:
                def __init__(self, app):
                    self.app = app

            dummy_request = DummyRequest(app)
            return process_csv_contents(
                dummy_request,
                contents,
                filename,
                username,
                parsed_ignored_columns,
                allow_live_stream=allow_live_stream,
            )

        job_id = start_background_job(job_target)
        return {"status": "accepted", "job_id": job_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint to check job status/result
@router.get("/upload_status/{job_id}")
def get_upload_job_status(job_id: str):
    job = get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job['status'] == 'completed':
        return {"status": "completed", "result": job['result']}
    elif job['status'] == 'error':
        return {"status": "error", "error": job['error']}
    else:
        return {"status": job['status']}
