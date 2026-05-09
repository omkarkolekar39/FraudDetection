import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import GraphSection from '../../components/UI/GraphSection';
import RiskBadge from '../../components/UI/RiskBadge';
import { executeAction } from '../../api/actionEndpoints';
import { getRiskDirectory } from '../../api/mlEndpoints';
import './ActionCenter.css';

const ActionCenter = () => {
    const [alerts, setAlerts] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getRiskDirectory('High', { offset: 0, limit: 100 });
                setAlerts(response?.data || []);
            } catch (error) {
                console.error('Failed to load alerts:', error);
            }
        };

        void load();
    }, []);

    const alertTrend = useMemo(() => alerts.slice(0, 20).map((alert) => ({
        label: alert.record_id || `R${alert.row_num}`,
        score: Number(alert.risk_score || 0),
    })), [alerts]);

    const handleAction = async (recordId, actionType) => {
        try {
            await executeAction(String(recordId), actionType);
            setStatusMessage(`${actionType} executed for ${recordId}.`);
        } catch (error) {
            setStatusMessage(error.response?.data?.detail || 'Unable to execute alert action.');
        }
    };

    return (
        <div className="page-shell alerts-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Alerts</span>
                    <h1 className="page-title">Flagged alerts stay front and center.</h1>
                    <p className="page-subtitle">
                        Review the current high-risk alert queue first, then use the dominant graph below to read score intensity across the latest flagged window.
                    </p>
                </div>
            </header>

            {statusMessage ? <div className="alerts-status">{statusMessage}</div> : null}

            <section className="alerts-list">
                {alerts.map((alert) => {
                    const recordId = alert.record_id || `RECORD ${alert.row_num}`;
                    return (
                        <article key={recordId} className="alert-card">
                            <div className="alert-card__main">
                                <div className="alert-card__icon">
                                    <ShieldAlert size={18} />
                                </div>
                                <div>
                                    <strong>{recordId}</strong>
                                    <p>Risk score {Number(alert.risk_score || 0).toFixed(2)} on row {alert.row_num}.</p>
                                </div>
                            </div>
                            <div className="alert-card__meta">
                                <RiskBadge value={alert.category} />
                                <div className="alert-card__actions">
                                    <button className="fintech-button-secondary" onClick={() => handleAction(recordId, 'Flag for Urgent Manual Review')} type="button">Escalate</button>
                                    <button className="fintech-button-danger" onClick={() => handleAction(recordId, 'Block Account & Card')} type="button">Block</button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>

            <GraphSection
                eyebrow="Alert Graph"
                title="Alert trend across the active queue"
                subtitle="A full-width signal view of alert intensity. The risk colors remain fixed: red for high, yellow for medium, and green for low."
            >
                <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={alertTrend}>
                        <defs>
                            <linearGradient id="alertFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FF4D4F" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#FF4D4F" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2fb" />
                        <XAxis dataKey="label" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="score" stroke="#FF4D4F" fill="url(#alertFill)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </GraphSection>
        </div>
    );
};

export default ActionCenter;
