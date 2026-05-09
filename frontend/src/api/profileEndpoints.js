import API from './axiosConfig';

/**
 * Fetches notifications/alerts for the logged-in operator.
 */
export const getMyNotifications = async () => {
    const response = await API.get('/notifications/my-alerts');
    return response.data;
};

/**
 * Changes the user's Access Key (Password).
 */
export const updatePassword = async (passwordData) => {
    // passwordData should be { oldPassword, newPassword }
    const response = await API.put('/profile/change-password', passwordData);
    return response.data;
};

/**
 * Marks a specific notification as read to clear it from the UI.
 */
export const markNotificationRead = async (notifId) => {
    const response = await API.put(`/notifications/read/${notifId}`);
    return response.data;
};

export const markAllNotificationsRead = async () => {
    const response = await API.put('/notifications/read-all');
    return response.data;
};

export const deleteNotification = async (notifId) => {
    const response = await API.delete(`/notifications/${notifId}`);
    return response.data;
};

export const clearReadNotifications = async () => {
    const response = await API.delete('/notifications/clear-read');
    return response.data;
};

/**
 * Fetches activity logs and stats for the user profile page.
 */
export const getProfileStats = async () => {
    const response = await API.get('/profile/activity-summary');
    return response.data;
};

// --- ALIAS EXPORTS (Fixes NotificationContext.jsx and Profile.jsx Errors) ---
export const getNotifications = getMyNotifications;
export const changePassword = updatePassword;
