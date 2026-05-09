// FraudDetectAI/frontend/src/pages/Dashboards/ViewerDashboard/ViewerDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle, Info } from 'lucide-react';
import StatCard from '../../../components/UI/StatCard';
import { getDashboardStats } from '../../../api/mlEndpoints';
import './ViewerDashboard.css';

const ViewerDashboard = () => {
    const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getDashboardStats();
                const meta = data?.metadata || data || {};
                setStats({
                    total: meta.total_records || 0,
                    high: meta.total_high_risk || 0,
                    medium: meta.total_medium_risk || 0,
                    low: meta.total_low_risk || 0
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="viewer-dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="page-title">Executive Overview</h1>
                    <p className="page-subtitle">Read-only portfolio risk metrics.</p>
                </div>
                <div className="readonly-badge">READ ONLY ACCESS</div>
            </header>

            <section className="stats-grid">
                <StatCard title="Total Evaluated" value={stats.total} icon={Activity} colorClass="icon-blue" />
                <StatCard title="High Risk" value={stats.high} icon={ShieldAlert} colorClass="icon-red" />
                <StatCard title="Low Risk (Safe)" value={stats.low} icon={CheckCircle} colorClass="icon-green" />
            </section>

            <div className="viewer-message">
                <Info size={24} className="info-icon" />
                <div>
                    <h4>Restricted Access</h4>
                    <p>You currently have Viewer access. To interact with the ML models, review specific customers, or manage the Action Center, please contact your System Administrator to upgrade your role to Risk Analyst.</p>
                </div>
            </div>
        </div>
    );
};

export default ViewerDashboard;