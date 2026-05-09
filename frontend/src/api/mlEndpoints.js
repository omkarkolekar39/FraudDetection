import API from './axiosConfig';

/**
 * TRIGGER NEURAL PIPELINE
 * Initiates Autoencoder and Isolation Forest training on the RAM buffer.
 */
export const runMlPipeline = async () => {
    try {
        // Matches @router.post("/run-pipeline") in run_analytics_api.py
        const response = await API.post('/ml/run-pipeline/');
        return response.data;
    } catch (error) {
        console.error("Neural Engine Execution Failure:", error);
        throw error;
    }
};

/**
 * GET ANALYTICS TOPOLOGY (MASTER SYNC)
 * Primary endpoint for both Admin Dashboard HUD and Analytics Charts.
 * Retrieves AE reconstruction errors and IF scores for X/Y plotting.
 */
export const getGraphsData = async (options = {}) => {
    const {
        includeRaw = false,
        mode = 'summary',
        start,
        end,
        limit = 200,
    } = options;

    try {
        // Matches prefix="/api/stats" + @router.get("/graphs") in main.py
        const response = await API.get('/stats/graphs/', {
            params: {
                include_raw: includeRaw,
                mode,
                start,
                end,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Neural Topology Sync Error:", error);
        // Returns safe fallback to prevent UI crashes if backend is empty
        return {
            status: "error",
            metadata: { total_records: 0, total_high_risk: 0, total_medium_risk: 0 },
            window_metadata: {
                mode,
                from_record: 1,
                to_record: 0,
                total_in_window: 0,
                rendered_records: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
                limited: false,
            },
            distribution: [],
            ae_errors_raw: [],
            if_scores_raw: [],
            risk_scores_raw: [],
        };
    }
};

/**
 * GET DASHBOARD HUD STATS
 * Specifically used for high-level metric summaries on the Master Control.
 */
export const getDashboardStats = async () => {
    try {
        // Matches prefix="/api/dashboard" in main.py
        const response = await API.get('/dashboard/');
        return response.data;
    } catch (error) {
        console.error("Dashboard HUD Sync Error:", error);
        return {
            status: "error",
            metadata: { total_records: 0, total_high_risk: 0, total_medium_risk: 0, total_low_risk: 0 }
        };
    }
};

/**
 * GET RISK DIRECTORY
 * Fetches accounts filtered by risk tier (High, Medium, Low).
 */
export const getRiskDirectory = async (riskTier = "High", options = {}) => {
    const { offset = 0, limit = 100 } = options;
    try {
        // Normalizes "High Risk" to "high" for query params
        const formattedTier = riskTier.split(" ")[0].toLowerCase();
        const response = await API.get('/directory/', {
            params: {
                risk_tier: formattedTier,
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Risk Directory Fetch Error [${riskTier}]:`, error);
        throw error;
    }
};

/**
 * GET CUSTOMER 360 PROFILE
 * Deep-dive into a specific record's feature reconstruction.
 */
export const getCustomer360 = async (accountId) => {
    if (!accountId || accountId === "undefined") return null;
    try {
        const response = await API.get(`/investigation/${accountId}`);
        return response.data;
    } catch (error) {
        console.error(`Profile Retrieval Error [ID: ${accountId}]:`, error);
        throw error;
    }
};

export const simulateCustomer360 = async (accountId, overrides) => {
    if (!accountId || accountId === "undefined") return null;
    try {
        const response = await API.post(`/investigation/${accountId}/simulate`, {
            overrides,
        });
        return response.data;
    } catch (error) {
        console.error(`Simulation Failure [ID: ${accountId}]:`, error);
        throw error;
    }
};

/**
 * GET XAI SHAP VALUES
 * Fetches impact drivers for the explainability waterfall charts.
 * Backend: GET /api/xai/{account_id}
 */
export const getXaiShap = async (accountId) => {
    if (!accountId || accountId === "undefined") return null;
    try {
        const response = await API.get(`/xai/${accountId}`);
        return response.data;
    } catch (error) {
        console.error(`XAI Extraction Failure [ID: ${accountId}]:`, error);
        throw error;
    }
};

export const getGlobalXai = async () => {
    try {
        const response = await API.get('/xai/global');
        return response.data;
    } catch (error) {
        console.error("Global XAI Fetch Failure:", error);
        throw error;
    }
};

