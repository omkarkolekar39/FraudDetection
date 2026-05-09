import API from './axiosConfig';
import { API_ORIGIN } from '../config/runtimeConfig';

/**
 * UPLOAD CSV DATA
 * Matches the name used in DataIngestion.jsx
 */
export const uploadCsvData = async (file, ignoredColumns = []) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ignored_columns', JSON.stringify(ignoredColumns));

    try {
        const response = await API.post('/data/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (response.data?.status !== 'accepted' || !response.data?.job_id) {
            return response.data;
        }

        return pollUploadJob(response.data.job_id);
    } catch (error) {
        console.error("Upload Bridge Failure:", error);
        throw error;
    }
};

export const getUploadJobStatus = async (jobId) => {
    const response = await API.get(`/data/upload_status/${jobId}`);
    return response.data;
};

const sleep = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

export const pollUploadJob = async (jobId, { intervalMs = 800, timeoutMs = 180000 } = {}) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const job = await getUploadJobStatus(jobId);

        if (job.status === 'completed') {
            return job.result;
        }

        if (job.status === 'error') {
            throw new Error(job.error || 'Dataset analysis failed.');
        }

        await sleep(intervalMs);
    }

    throw new Error('Dataset analysis is still running. Please try again in a moment.');
};

/**
 * SET RISK THRESHOLDS
 * Matches the name used in DataIngestion.jsx
 */
export const setRiskThresholds = async (mid, high) => {
    try {
        const response = await API.post('/data/thresholds', {
            medium: mid,
            high: high
        });
        return response.data;
    } catch (error) {
        console.error("Threshold Bridge Failure:", error);
        throw error;
    }
};

export const publishLiveStreamRow = async (rowData, source = 'manual-ui') => {
    const response = await API.post('/data/live-stream/publish', {
        row_data: rowData,
        source,
    });
    return response.data;
};

export const getLiveStreamStatus = async () => {
    const response = await API.get('/data/live-stream/status');
    return response.data;
};

export const watchCsvFilePath = async (path) => {
    const response = await API.post('/data/live-stream/watch-file', { path });
    return response.data;
};

export const getLiveStreamSocketUrl = () => {
    const wsOrigin = API_ORIGIN.replace(/^http/i, 'ws');
    return `${wsOrigin}/api/data/live-stream/ws`;
};
