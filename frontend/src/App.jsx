import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { LiveDatasetWatchProvider } from './contexts/LiveDatasetWatchContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/UI/ProtectedRoute';

import './App.css';

const Auth = lazy(() => import('./pages/Auth/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Audits = lazy(() => import('./pages/Audits/Audits'));
const LiveStream = lazy(() => import('./pages/LiveStream/LiveStream'));
const AdminDashboard = lazy(() => import('./pages/Dashboards/AdminDashboard/AdminDashboard'));
const AnalystDashboard = lazy(() => import('./pages/Dashboards/AnalystDashboard/AnalystDashboard'));
const ViewerDashboard = lazy(() => import('./pages/Dashboards/ViewerDashboard/ViewerDashboard'));
const DataIngestion = lazy(() => import('./pages/DataIngestion/DataIngestion'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
const RiskDirectory = lazy(() => import('./pages/RiskDirectory/RiskDirectory'));
const Customer360 = lazy(() => import('./pages/Customer360/Customer360'));
const XAIDashboard = lazy(() => import('./pages/XAIDashboard/XAIDashboard'));
const ActionCenter = lazy(() => import('./pages/ActionCenter/ActionCenter'));
const AuditLogs = lazy(() => import('./pages/AuditLogs/AuditLogs'));
const Profile = lazy(() => import('./pages/Profile/Profile'));

const RouteLoading = () => (
    <div className="route-loading-page">
        <div className="spinner"></div>
        <p>Loading secure workspace...</p>
    </div>
);

const AppRoutes = () => {
    return (
        <Suspense fallback={<RouteLoading />}>
            <Routes>
                <Route path="/login" element={<Auth defaultMode="login" />} />
                <Route path="/register" element={<Auth defaultMode="register" />} />

                <Route path="/" element={
                    <ProtectedRoute>
                        <Navigate to="/dashboard" replace />
                    </ProtectedRoute>
                } />

                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />

                <Route path="/admin-dashboard" element={
                    <ProtectedRoute allowedRoles={['Admin']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/analyst-dashboard" element={
                    <ProtectedRoute allowedRoles={['Analyst']}>
                        <AnalystDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/viewer-dashboard" element={
                    <ProtectedRoute allowedRoles={['Viewer']}>
                        <ViewerDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/ingestion" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <DataIngestion />
                    </ProtectedRoute>
                } />

                <Route path="/analytics" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <Analytics />
                    </ProtectedRoute>
                } />

                <Route path="/directory" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <RiskDirectory />
                    </ProtectedRoute>
                } />

                <Route path="/customer-360" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst']}>
                        <Customer360 />
                    </ProtectedRoute>
                } />

                <Route path="/xai" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <XAIDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/live-stream" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <LiveStream />
                    </ProtectedRoute>
                } />

                <Route path="/audits" element={
                    <ProtectedRoute allowedRoles={['Admin']}>
                        <Audits />
                    </ProtectedRoute>
                } />

                <Route path="/actions" element={
                    <ProtectedRoute allowedRoles={['Admin']}>
                        <ActionCenter />
                    </ProtectedRoute>
                } />

                <Route path="/audit-logs" element={
                    <ProtectedRoute allowedRoles={['Admin']}>
                        <AuditLogs />
                    </ProtectedRoute>
                } />

                <Route path="/profile" element={
                    <ProtectedRoute allowedRoles={['Admin', 'Analyst', 'Viewer']}>
                        <Profile />
                    </ProtectedRoute>
                } />

                <Route path="*" element={
                    <div className="not-found-page">
                        <h2>404 - System Route Not Found</h2>
                        <p>The requested module does not exist or you lack sufficient clearance.</p>
                    </div>
                } />
            </Routes>
        </Suspense>
    );
};

function App() {
    return (
        <AuthProvider>
            <LiveDatasetWatchProvider>
                <NotificationProvider>
                    <Layout>
                        <AppRoutes />
                    </Layout>
                </NotificationProvider>
            </LiveDatasetWatchProvider>
        </AuthProvider>
    );
}

export default App;
