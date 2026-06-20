// FraudDetectAI/frontend/src/api/actionEndpoints.js

import API from './axiosConfig';

/**
 * Executes a business remediation action on a flagged account.
 * Backend: POST /api/actions/execute
 */
export const executeAction = async (accountId, actionType) => {
    const response = await API.post('/actions/execute', {
        account_id: accountId,
        action_type: actionType
    });
    return response.data;
};

/**
 * Fetches system audit logs.
 * Backend: GET /api/admin/audit-logs
 */
export const getAuditLogs = async (limit = 50) => {
    const response = await API.get(`/admin/audit-logs?limit=${limit}`);
    return response.data;
};