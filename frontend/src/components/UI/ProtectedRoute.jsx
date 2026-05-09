// FraudDetectAI/frontend/src/components/UI/ProtectedRoute.jsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import './ProtectedRoute.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    // 1. Wait for the AuthContext to finish checking local storage / validating token
    if (loading) {
        return (
            <div className="protected-loading-screen">
                <div className="spinner"></div>
                <p>Verifying Security Credentials...</p>
            </div>
        );
    }

    // 2. If the user is not logged in at all, redirect to the login page.
    // We pass the location they were trying to access in the state, so you could redirect them back after login.
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. If the route has restricted roles, check if the current user's role is allowed.
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Unauthorized access attempt. Route them back to their specific dashboard safely.
        if (user.role === 'Admin') return <Navigate to="/admin-dashboard" replace />;
        if (user.role === 'Analyst') return <Navigate to="/analyst-dashboard" replace />;
        return <Navigate to="/viewer-dashboard" replace />;
    }

    // 4. User is authenticated and authorized. Render the requested page.
    return children;
};

export default ProtectedRoute;
