// FraudDetectAI/frontend/src/contexts/NotificationContext.jsx

import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
    clearReadNotifications,
    deleteNotification,
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '../api/profileEndpoints';
import { useAuth } from './useAuth';

const NotificationContext = createContext(null);
export { NotificationContext };

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isAuthenticated } = useAuth();

    const fetchNotifications = useCallback(async () => {
        // If not logged in, don't even try to call the API
        if (!isAuthenticated) return;

        try {
            const data = await getNotifications();

            // Ensure data is an array before setting state
            const safeData = Array.isArray(data) ? data : [];
            setNotifications(safeData);
            setUnreadCount(safeData.filter(n => !n.is_read).length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            // CRITICAL: Set empty state so the AppLayout doesn't hang/crash
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        let intervalId;
        const timeoutId = window.setTimeout(() => {
            if (isAuthenticated) {
                void fetchNotifications();
                intervalId = window.setInterval(fetchNotifications, 30000);
                return;
            }

            setNotifications([]);
            setUnreadCount(0);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
            if (intervalId) {
                window.clearInterval(intervalId);
            }
        };
    }, [isAuthenticated, fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        try {
            await markAllNotificationsRead();
            setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }, []);

    const markOneAsRead = useCallback(async (notificationId) => {
        try {
            await markNotificationRead(notificationId);
            setNotifications((prev) => {
                const target = prev.find((notification) => notification.id === notificationId);
                if (target && !target.is_read) {
                    setUnreadCount((count) => Math.max(0, count - 1));
                }
                return prev.map((notification) => (
                    notification.id === notificationId
                        ? { ...notification, is_read: true }
                        : notification
                ));
            });
        } catch (error) {
            console.error(`Failed to mark notification ${notificationId} as read:`, error);
        }
    }, []);

    const removeNotification = useCallback(async (notificationId) => {
        try {
            await deleteNotification(notificationId);
            setNotifications((prev) => {
                const target = prev.find((notification) => notification.id === notificationId);
                if (target && !target.is_read) {
                    setUnreadCount((count) => Math.max(0, count - 1));
                }
                return prev.filter((notification) => notification.id !== notificationId);
            });
        } catch (error) {
            console.error(`Failed to delete notification ${notificationId}:`, error);
        }
    }, []);

    const clearRead = useCallback(async () => {
        try {
            const response = await clearReadNotifications();
            const deletedIds = new Set(response?.deleted_ids || []);
            setNotifications((prev) => prev.filter((notification) => !deletedIds.has(notification.id)));
        } catch (error) {
            console.error('Failed to clear read notifications:', error);
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        await fetchNotifications();
    }, [fetchNotifications]);

    const addLocalNotification = useCallback((message) => {
        const newNotif = {
            id: Date.now(),
            message,
            is_read: false,
            time: 'Just now',
        };
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
    }, []);

    const value = {
        notifications,
        unreadCount,
        fetchNotifications: refreshNotifications,
        markAllAsRead,
        markOneAsRead,
        removeNotification,
        clearRead,
        addLocalNotification,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
