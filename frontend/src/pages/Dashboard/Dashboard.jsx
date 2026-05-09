import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BarChart3, Database, ShieldAlert, Users } from 'lucide-react';

import { getDashboardStats } from '../../api/mlEndpoints';
import RiskBadge from '../../components/UI/RiskBadge';
import { useAuth } from '../../contexts/useAuth';
import { resolveHomeRoute } from '../../services/navigation';
import './Dashboard.css';
import { exportDashboardReport } from '../../utils/pdfExport';
import { useRef } from 'react';

const Dashboard = () => {
    const { user } = useAuth();
    const [dashboardStats, setDashboardStats] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const dashboardRef = useRef();

    useEffect(() => {
        let isMounted = true;

        const loadDashboardStats = async () => {
            try {
                const response = await getDashboardStats();
                if (isMounted) {
                    setDashboardStats(response?.metadata || {});
                    setStatusMessage('');
                }
            } catch (error) {
                console.error('Failed to load dashboard stats:', error);
                if (isMounted) {
                    setStatusMessage('Dashboard metrics are not available yet.');
                }
            }
        };

        void loadDashboardStats();

        return () => {
            isMounted = false;
        };
    }, []);

    const metrics = dashboardStats || {};
    const totalRecords = Number(metrics.total_records || 0);

    const riskCards = useMemo(() => ([
        {
            label: 'High risk',
            value: Number(metrics.total_high_risk || 0),
            tone: 'high',
            description: 'Records that need immediate investigation.',
        },
        {
            label: 'Medium risk',
            value: Number(metrics.total_medium_risk || 0),
            tone: 'medium',
            description: 'Records worth monitoring or triage.',
        },
        {
            label: 'Low risk',
            value: Number(metrics.total_low_risk || 0),
            tone: 'low',
            description: 'Records currently below action threshold.',
        },
    ]), [metrics.total_high_risk, metrics.total_medium_risk, metrics.total_low_risk]);

    const homeRoute = resolveHomeRoute(user?.role);

    const handleDownloadReport = async () => {
        await exportDashboardReport({
            dashboardRef: dashboardRef.current,
            stats: {
                totalRecords,
                highRisk: metrics.total_high_risk || 0,
                mediumRisk: metrics.total_medium_risk || 0,
                lowRisk: metrics.total_low_risk || 0,
                riskExposure: metrics.risk_exposure || 0,
            },
            chartsSelectors: [
                '.dashboard-summary-grid',
                '.dashboard-risk-grid',
            ],
        });
    };

    return (
        <div className="page-shell dashboard-page" ref={dashboardRef}>
            <header className="page-header-block dashboard-header">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Dashboard</span>
                    <h1 className="page-title">Risk overview for the current workspace.</h1>
                    <p className="page-subtitle">
                        A clean summary of processed records, risk spread, and model activity without hiding the role-specific dashboards you already use.
                    </p>
                </div>
                <Link className="fintech-button" to={homeRoute}>
                    Open {user?.role || 'Viewer'} workspace
                </Link>
                <button className="fintech-button" style={{marginLeft: 16}} onClick={handleDownloadReport} type="button">
                    Download Report
                </button>
            </header>

            {statusMessage ? <div className="dashboard-status">{statusMessage}</div> : null}

            <section className="dashboard-summary-grid">
                <article className="surface-card dashboard-summary-card">
                    <Database size={20} />
                    <span>Total records</span>
                    <strong>{totalRecords.toLocaleString()}</strong>
                </article>
                <article className="surface-card dashboard-summary-card">
                    <ShieldAlert size={20} />
                    <span>Risk exposure</span>
                    <strong>{Number(metrics.risk_exposure || 0).toFixed(1)}%</strong>
                </article>
                <article className="surface-card dashboard-summary-card">
                    <Users size={20} />
                    <span>Active users</span>
                    <strong>{Number(metrics.active_analysts || 0).toLocaleString()}</strong>
                </article>
                <article className="surface-card dashboard-summary-card">
                    <Activity size={20} />
                    <span>Model signal</span>
                    <strong>{Number(metrics.ae_avg_pct || 0).toFixed(1)}%</strong>
                </article>
            </section>

            <section className="dashboard-risk-grid">
                {riskCards.map((riskCard) => {
                    const percent = totalRecords > 0 ? Math.round((riskCard.value / totalRecords) * 100) : 0;

                    return (
                        <article key={riskCard.tone} className={`surface-card dashboard-risk-card dashboard-risk-card--${riskCard.tone}`}>
                            <div className="dashboard-risk-card__header">
                                <RiskBadge value={riskCard.tone} />
                                <span>{percent}%</span>
                            </div>
                            <strong>{riskCard.value.toLocaleString()}</strong>
                            <p>{riskCard.description}</p>
                            <progress className="dashboard-risk-meter" value={percent} max="100">
                                {percent}%
                            </progress>
                        </article>
                    );
                })}
            </section>

            <section className="surface-card dashboard-next-step">
                <div>
                    <span className="page-eyebrow">Next step</span>
                    <h2>Review deeper analytics when the summary changes.</h2>
                    <p>
                        Use the analytics and audit pages for the detailed trail. The cards above stay intentionally simple so the main route is useful for every role.
                    </p>
                </div>
                <Link className="fintech-button-secondary" to="/analytics">
                    <BarChart3 size={16} />
                    View analytics
                </Link>
            </section>
        </div>
    );
};

export default Dashboard;
