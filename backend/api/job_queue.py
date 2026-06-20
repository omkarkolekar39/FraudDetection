import threading
import uuid

# In-memory job store
job_store = {}

class JobStatus:
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    ERROR = 'error'

def start_background_job(target, *args, **kwargs):
    job_id = str(uuid.uuid4())
    job_store[job_id] = {'status': JobStatus.PENDING, 'result': None, 'error': None}

    def job_wrapper():
        job_store[job_id]['status'] = JobStatus.RUNNING
        try:
            result = target(*args, **kwargs)
            job_store[job_id]['result'] = result
            job_store[job_id]['status'] = JobStatus.COMPLETED
        except Exception as e:
            job_store[job_id]['error'] = str(e)
            job_store[job_id]['status'] = JobStatus.ERROR

    thread = threading.Thread(target=job_wrapper)
    thread.start()
    return job_id

def get_job_status(job_id):
    return job_store.get(job_id, None)
