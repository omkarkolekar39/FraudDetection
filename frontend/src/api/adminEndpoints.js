import API from './axiosConfig';

/**
 * Fetches all users currently awaiting approval.
 * Backend: @router.get("/pending-users") with prefix "/api/admin"
 */
export const getPendingApprovals = async () => {
    const response = await API.get('/admin/pending-users');
    return response.data;
};

/**
 * Promotes a Viewer to a Risk Analyst.
 * Backend: @router.post("/approve-analyst")
 */
export const approveAnalystRequest = async (username) => {
    // Sending username in the body as expected by your Pydantic schemas
    const response = await API.post('/admin/approve-analyst', { username });
    return response.data;
};

/**
 * Rejects an Analyst registration request.
 * Backend: @router.post("/reject-analyst")
 */
export const rejectAnalystRequest = async (username) => {
    const response = await API.post('/admin/reject-analyst', { username });
    return response.data;
};

// --- ALIAS EXPORTS (Fixes AdminDashboard.jsx component imports) ---
export const approveAnalyst = approveAnalystRequest;
export const rejectAnalyst = rejectAnalystRequest;

export const getSystemSummary = async () => {
    const response = await API.get('/admin/system-summary');
    return response.data;
};

export const getAllUsers = async () => {
    const response = await API.get('/admin/users');
    return response.data;
};

export const updateUserRole = async (username, role) => {
    const response = await API.patch(`/admin/users/${username}/role`, { role });
    return response.data;
};
