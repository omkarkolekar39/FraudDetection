import axios from 'axios';
import { API_BASE_URL, PUBLIC_AUTH_ROUTES } from '../config/runtimeConfig';
import { clearAuthSession, getAuthToken } from '../utils/authStorage';

/**
 * Global Axios Instance for FraudDetectAI
 * Configured for Arctic 3D Terminal connectivity
 */
const API = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * REQUEST INTERCEPTOR
 * Automatically attaches the JWT 'access_token' to every outgoing
 * request header for protected routes (Stats, Notifications, ML Engine).
 */
API.interceptors.request.use(
    (config) => {
        const token = getAuthToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * RESPONSE INTERCEPTOR
 * Handles global security events like session expiration (401).
 */
API.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle Session Expiration or Invalid Token
        if (error.response && error.response.status === 401) {
            const currentPath = window.location.pathname;

            if (!PUBLIC_AUTH_ROUTES.includes(currentPath)) {
                clearAuthSession();
                window.location.href = '/login';
            }
        }

        // Pass the error back to the local catch block (e.g., in Login.jsx)
        return Promise.reject(error);
    }
);

export default API;
