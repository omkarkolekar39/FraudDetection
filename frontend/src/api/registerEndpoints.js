import API from './axiosConfig';

/**
 * Helper to extract a readable string from FastAPI/Pydantic error objects.
 * This prevents the "Objects are not valid as a React child" error.
 */
const extractErrorMessage = (error) => {
    if (error.response && error.response.data) {
        const data = error.response.data;

        // Handle FastAPI standard 'detail'
        if (data.detail) {
            if (typeof data.detail === 'string') return data.detail;
            if (Array.isArray(data.detail)) return data.detail[0].msg;
        }

        if (data.message) return data.message;
    }

    // Handle Network/Server Down
    if (error.code === 'ERR_NETWORK' || (error.request && !error.response)) {
        return "Terminal Link Failure: The security server is offline.";
    }

    return error.message || "An unexpected registration error occurred.";
};

/**
 * Registers a new operator account.
 * * @param {Object} userData - { username, password, role }
 * @returns {Promise<Object>} - The created user data and server message
 */
export const registerOperator = async (userData) => {
    try {
        const response = await API.post('/auth/register', userData);

        return response.data;
    } catch (error) {
        const readableErrorString = extractErrorMessage(error);

        // We throw a standardized Error object containing only the string message
        throw new Error(readableErrorString, { cause: error });
    }
};
