import API from './axiosConfig';

/**
 * Standardized Error Parser for the FraudDetectAI Terminal
 */
const extractErrorMessage = (error) => {
    if (error.response && error.response.data) {
        const data = error.response.data;
        if (data.detail) {
            return typeof data.detail === 'string' ? data.detail : data.detail[0].msg;
        }
    }
    if (error.code === 'ERR_NETWORK') return "Terminal Link Failure: Security server is offline.";
    return "Access Denied: Connection error.";
};

/**
 * loginOperator: Communicates with FastAPI and seeds LocalStorage
 */
export const loginOperator = async (credentials) => {
    try {
        const response = await API.post('/auth/login', credentials);
        return response.data;
    } catch (error) {
        const message = extractErrorMessage(error);
        throw new Error(message, { cause: error });
    }
};
