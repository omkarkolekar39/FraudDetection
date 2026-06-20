import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Database,
    FileClock,
    RefreshCcw,
    ShieldAlert,
    UserCog,
    UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { getAuditLogs } from '../../../api/actionEndpoints';
import {
    approveAnalyst,
    getAllUsers,
    getPendingApprovals,
    getSystemSummary,
    rejectAnalyst,
    updateUserRole,
} from '../../../api/adminEndpoints';
import { getGraphsData } from '../../../api/mlEndpoints';
import GraphSection from '../../../components/UI/GraphSection';
import StatCard from '../../../components/UI/StatCard';
import './AdminDashboard.css';

const DASHBOARD_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'approvals', label: 'Approvals' },
    { key: 'audits', label: 'Audits' },
];

const bucketSeries = (records = [], bucketCount = 10) => {
    if (!records.length) return [];

    const size = Math.max(1, Math.ceil(records.length / bucketCount));
    const buckets = [];

    for (let index = 0; index < records.length; index += size) {
        const slice = records.slice(index, index + size);
        const highCount = slice.filter((item) => item.category === 'high').length;

        buckets.push({
            label: `${slice[0].row_num}-${slice[slice.length - 1].row_num}`,
            volume: slice.length,
            fraudRate: Number(((highCount / slice.length) * 100).toFixed(1)),
        });
    }

    return buckets;
};

const formatTimestamp = (value) => value
    ? new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
    : '-';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [dashboardStats, setDashboardStats] = useState({
        totalRecords: 0,
        highRisk: 0,
        mediumRisk: 0,
        totalUsers: 0,
        systemHealth: 'Online',
    });
    const [systemSummary, setSystemSummary] = useState({
        total_users: 0,
        admins: 0,
        analysts: 0,
        viewers: 0,
        pending_requests: 0,
        audit_events: 0,
    });
    const [graphRows, setGraphRows] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [graphRes, pendingRes, summaryRes, usersRes, auditsRes] = await Promise.all([
                    getGraphsData({ includeRaw: true, mode: 'sample', limit: 200 }),
                    getPendingApprovals(),
                    getSystemSummary(),
                    getAllUsers(),
                    getAuditLogs(12),
                ]);

                const metadata = graphRes?.metadata || {};
                const nextSummary = summaryRes || {};
                setDashboardStats({
                    totalRecords: Number(metadata.total_records || 0),
                    highRisk: Number(metadata.total_high_risk || 0),
                    mediumRisk: Number(metadata.total_medium_risk || 0),
                    totalUsers: Number(nextSummary.total_users || 0),
                    systemHealth: summaryRes ? 'Online' : 'Offline',
                });
                setSystemSummary({
                    total_users: Number(nextSummary.total_users || 0),
                    admins: Number(nextSummary.admins || 0),
                    analysts: Number(nextSummary.analysts || 0),
                    viewers: Number(nextSummary.viewers || 0),
                    pending_requests: Number(nextSummary.pending_requests || 0),
                    audit_events: Number(nextSummary.audit_events || 0),
                });
                setGraphRows(graphRes?.risk_scores_raw || []);
                setPendingUsers(Array.isArray(pendingRes) ? pendingRes : []);
                setAllUsers(Array.isArray(usersRes) ? usersRes : []);
                setAuditLogs(Array.isArray(auditsRes) ? auditsRes : []);
            } catch (error) {
                console.error('Failed to load admin dashboard:', error);
                setStatusMessage('Unable to load the full admin control layer right now.');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, []);

    const chartBuckets = useMemo(() => bucketSeries(graphRows, 10), [graphRows]);

    const updateLocalRole = (username, nextRole) => {
        setAllUsers((current) => current.map((user) => (
            user.username === username
                ? { ...user, role: nextRole, is_pending_approval: false }
                : user
        )));
        setPendingUsers((current) => current.filter((user) => user.username !== username));
    };

    const updateSummaryCounts = (fromRole, toRole) => {
        setSystemSummary((current) => {
            const next = { ...current };
            if (fromRole === 'Viewer') next.viewers = Math.max(0, next.viewers - 1);
            if (fromRole === 'Analyst') next.analysts = Math.max(0, next.analysts - 1);
            if (toRole === 'Viewer') next.viewers += 1;
            if (toRole === 'Analyst') next.analysts += 1;
            return next;
        });

        setDashboardStats((current) => ({
            ...current,
            totalUsers: Math.max(current.totalUsers, allUsers.length),
        }));
    };

    const handleApprove = async (username) => {
        try {
            await approveAnalyst(username);
            updateLocalRole(username, 'Analyst');
            updateSummaryCounts('Viewer', 'Analyst');
            setSystemSummary((current) => ({
                ...current,
                pending_requests: Math.max(0, current.pending_requests - 1),
            }));
            setStatusMessage(`${username} now has Analyst access.`);
        } catch (error) {
            console.error('Approval failed:', error);
            setStatusMessage(error.response?.data?.detail || `Unable to approve ${username}.`);
        }
    };

    const handleReject = async (username) => {
        try {
            await rejectAnalyst(username);
            setPendingUsers((current) => current.filter((user) => user.username !== username));
            setAllUsers((current) => current.filter((user) => user.username !== username));
            setSystemSummary((current) => ({
                ...current,
                total_users: Math.max(0, current.total_users - 1),
                viewers: Math.max(0, current.viewers - 1),
                pending_requests: Math.max(0, current.pending_requests - 1),
            }));
            setDashboardStats((current) => ({
                ...current,
                totalUsers: Math.max(0, current.totalUsers - 1),
            }));
            setStatusMessage(`${username} was removed from pending approvals.`);
        } catch (error) {
            console.error('Rejection failed:', error);
            setStatusMessage(error.response?.data?.detail || `Unable to reject ${username}.`);
        }
    };

    const handleRoleUpdate = async (user, nextRole) => {
        try {
            await updateUserRole(user.username, nextRole);
            updateLocalRole(user.username, nextRole);
            updateSummaryCounts(user.role, nextRole);
            setStatusMessage(`${user.username} changed from ${user.role} to ${nextRole}.`);
        } catch (error) {
            console.error('Role update failed:', error);
            setStatusMessage(error.response?.data?.detail || `Unable to update ${user.username}.`);
        }
    };

    if (isLoading) {
        return (
            <div className="dashboard-loading-overlay">
                <RefreshCcw className="spinning" size={36} color="var(--primary-purple)" />
                <p>Loading master dashboard...</p>
            </div>
        );
    }

    return (
        <div className="page-shell admin-dashboard">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Admin Dashboard</span>
                    <h1 className="page-title">Fraud control at a portfolio level.</h1>
                    <p className="page-subtitle">
                        Track fraud pressure, manage user roles, review approval queues, and inspect audit activity from one control surface.
                    </p>
                </div>
            </header>

            {statusMessage ? <div className="admin-status-banner">{statusMessage}</div> : null}

            <section className="admin-metric-grid">
                <StatCard title="Total Transactions" subtitle="Processed records in the active runtime session" value={dashboardStats.totalRecords.toLocaleString()} icon={Database} colorClass="icon-blue" />
                <StatCard title="Fraud Detected" subtitle="High-risk cases needing immediate review" value={dashboardStats.highRisk.toLocaleString()} icon={ShieldAlert} colorClass="icon-red" />
                <StatCard title="Active Alerts" subtitle="Medium-risk anomalies requiring monitoring" value={dashboardStats.mediumRisk.toLocaleString()} icon={AlertTriangle} colorClass="icon-yellow" />
                <StatCard title="Total Users" subtitle="All accounts currently in the database" value={dashboardStats.totalUsers.toLocaleString()} icon={UsersRound} colorClass="icon-blue" />
                <StatCard title="System Health" subtitle="Live sync across ingestion, users, and audits" value={dashboardStats.systemHealth} icon={Activity} colorClass="icon-green" />
            </section>

            <GraphSection
                eyebrow="Portfolio Graphs"
                title="Portfolio volume and fraud pressure dominate the page."
                subtitle="Both views reflect the latest analytics results. CSV rows themselves are not persisted to Supabase anymore."
            >
                <div className="admin-graph-grid">
                    <div className="admin-graph-card">
                        <h3>Transaction Volume</h3>
                        <ResponsiveContainer width="100%" height={360}>
                            <AreaChart data={chartBuckets}>
                                <defs>
                                    <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.32} />
                                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.04} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe9ea" />
                                <XAxis dataKey="label" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="volume" stroke="#0f766e" fill="url(#volumeFill)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="admin-graph-card">
                        <h3>Fraud Rate</h3>
                        <ResponsiveContainer width="100%" height={360}>
                            <BarChart data={chartBuckets}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe9ea" />
                                <XAxis dataKey="label" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => [`${value}%`, 'Fraud Rate']} />
                                <Bar dataKey="fraudRate" fill="#ea2261" radius={[10, 10, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </GraphSection>

            <section className="surface-card admin-control-panel">
                <div className="admin-panel-toolbar">
                    <div>
                        <span className="page-eyebrow">Admin Controls</span>
                        <h2>Users, approvals, and audit visibility</h2>
                    </div>
                    <div className="admin-tab-list">
                        {DASHBOARD_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                className={`admin-tab-button ${activeTab === tab.key ? 'is-active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                                type="button"
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'overview' ? (
                    <div className="admin-tab-content">
                        <div className="admin-overview-grid">
                            <div className="admin-summary-card">
                                <div className="admin-summary-card__icon">
                                    <UserCog size={18} />
                                </div>
                                <strong>{systemSummary.admins}</strong>
                                <span>Admins</span>
                            </div>
                            <div className="admin-summary-card">
                                <div className="admin-summary-card__icon">
                                    <UsersRound size={18} />
                                </div>
                                <strong>{systemSummary.analysts}</strong>
                                <span>Analysts</span>
                            </div>
                            <div className="admin-summary-card">
                                <div className="admin-summary-card__icon">
                                    <UsersRound size={18} />
                                </div>
                                <strong>{systemSummary.viewers}</strong>
                                <span>Viewers</span>
                            </div>
                            <div className="admin-summary-card">
                                <div className="admin-summary-card__icon">
                                    <FileClock size={18} />
                                </div>
                                <strong>{systemSummary.audit_events}</strong>
                                <span>Audit Events</span>
                            </div>
                        </div>

                        <div className="admin-quick-links">
                            <Link className="admin-link-card" to="/directory">
                                <strong>Transactions</strong>
                                <span>Open the full transaction list with lazy-loaded records.</span>
                            </Link>
                            <Link className="admin-link-card" to="/actions">
                                <strong>Alerts</strong>
                                <span>Review the active queue of flagged high-risk events.</span>
                            </Link>
                            <Link className="admin-link-card" to="/audit-logs">
                                <strong>Full Audit Page</strong>
                                <span>Open the complete audit log screen for deeper review.</span>
                            </Link>
                        </div>
                    </div>
                ) : null}

                {activeTab === 'users' ? (
                    <div className="admin-tab-content">
                        <div className="admin-section-header">
                            <div>
                                <span className="page-eyebrow">User Access</span>
                                <h3>Manage roles directly from the dashboard</h3>
                            </div>
                            <span className="admin-panel__count">{allUsers.length}</span>
                        </div>

                        <div className="admin-user-table-wrap">
                            <table className="admin-user-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allUsers.map((user) => (
                                        <tr key={user.username}>
                                            <td>{user.username}</td>
                                            <td><span className={`admin-role-pill admin-role-pill--${String(user.role || '').toLowerCase()}`}>{user.role}</span></td>
                                            <td>{user.is_pending_approval ? 'Pending Analyst Approval' : 'Active'}</td>
                                            <td>{formatTimestamp(user.created_at)}</td>
                                            <td>
                                                <div className="admin-user-actions">
                                                    {user.role === 'Viewer' ? (
                                                        <button className="fintech-button" onClick={() => handleRoleUpdate(user, 'Analyst')} type="button">
                                                            Promote to Analyst
                                                        </button>
                                                    ) : null}
                                                    {user.role === 'Analyst' ? (
                                                        <button className="fintech-button-secondary" onClick={() => handleRoleUpdate(user, 'Viewer')} type="button">
                                                            Degrade to Viewer
                                                        </button>
                                                    ) : null}
                                                    {user.role === 'Admin' ? (
                                                        <span className="admin-user-lock">Admin account locked</span>
                                                    ) : null}
                                                    {!['Admin', 'Analyst', 'Viewer'].includes(user.role) ? (
                                                        <span className="admin-user-lock">No action available</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}

                {activeTab === 'approvals' ? (
                    <div className="admin-tab-content">
                        <div className="admin-section-header">
                            <div>
                                <span className="page-eyebrow">Approvals</span>
                                <h3>Pending analyst requests</h3>
                            </div>
                            <span className="admin-panel__count">{pendingUsers.length}</span>
                        </div>

                        {pendingUsers.length > 0 ? (
                            <div className="admin-approval-list">
                                {pendingUsers.map((user) => (
                                    <div key={user.username} className="admin-approval-row">
                                        <div>
                                            <strong>{user.username}</strong>
                                            <span>Awaiting elevated analyst access</span>
                                        </div>
                                        <div className="admin-approval-actions">
                                            <button className="fintech-button-secondary" onClick={() => handleReject(user.username)} type="button">Reject</button>
                                            <button className="fintech-button" onClick={() => handleApprove(user.username)} type="button">Approve</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="admin-empty-state">No pending approvals right now.</div>
                        )}
                    </div>
                ) : null}

                {activeTab === 'audits' ? (
                    <div className="admin-tab-content">
                        <div className="admin-section-header">
                            <div>
                                <span className="page-eyebrow">Audits</span>
                                <h3>Recent audit activity</h3>
                            </div>
                            <span className="admin-panel__count">{systemSummary.audit_events}</span>
                        </div>

                        <div className="admin-audit-grid">
                            <div className="admin-audit-summary">
                                <div className="admin-audit-stat">
                                    <span>Total Users</span>
                                    <strong>{systemSummary.total_users}</strong>
                                </div>
                                <div className="admin-audit-stat">
                                    <span>Pending Requests</span>
                                    <strong>{systemSummary.pending_requests}</strong>
                                </div>
                                <div className="admin-audit-stat">
                                    <span>Audit Events</span>
                                    <strong>{systemSummary.audit_events}</strong>
                                </div>
                            </div>

                            <div className="admin-audit-table-wrap">
                                <table className="admin-audit-table">
                                    <thead>
                                        <tr>
                                            <th>Action</th>
                                            <th>Operator</th>
                                            <th>Role</th>
                                            <th>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td>{log.action}</td>
                                                <td>{log.username}</td>
                                                <td>{log.role}</td>
                                                <td>{formatTimestamp(log.timestamp)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : null}
            </section>
        </div>
    );
};

export default AdminDashboard;
