import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import { getAuditLogs } from '../../api/actionEndpoints';
import './AuditLogs.css';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLogId, setSelectedLogId] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAuditLogs(150);
                const nextLogs = Array.isArray(data) ? data : [];
                setLogs(nextLogs);
                setSelectedLogId(nextLogs[0]?.id || null);
            } catch (error) {
                console.error('Failed to load audit logs:', error);
            }
        };

        void load();
    }, []);

    const filteredLogs = useMemo(() => logs.filter((log) =>
        [log.username, log.action, log.details, log.role]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
    ), [logs, searchTerm]);

    const selectedLog = filteredLogs.find((log) => log.id === selectedLogId) || filteredLogs[0] || null;

    const timelineRows = useMemo(() => filteredLogs.slice(0, 24).map((log, index) => ({
        label: `#${index + 1}`,
        intensity: index + 1,
    })), [filteredLogs]);

    const formatTimestamp = (rawValue) => rawValue
        ? new Date(rawValue).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : '-';

    return (
        <div className="page-shell case-management-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Case Management</span>
                    <h1 className="page-title">Review cases, classify outcomes, and keep the audit trail visible.</h1>
                    <p className="page-subtitle">
                        This page acts as the case-management layer: selected case details at the top, confirm-fraud and false-positive decisions in the middle, and a full-width timeline graph at the bottom.
                    </p>
                </div>
            </header>

            <section className="case-management-top">
                <div className="surface-card case-details-card">
                    <span className="page-eyebrow">Case Details</span>
                    <h2>{selectedLog?.action || 'No case selected'}</h2>
                    <div className="case-detail-grid">
                        <div>
                            <span>Operator</span>
                            <strong>{selectedLog?.username || '-'}</strong>
                        </div>
                        <div>
                            <span>Timestamp</span>
                            <strong>{formatTimestamp(selectedLog?.timestamp)}</strong>
                        </div>
                        <div>
                            <span>Role</span>
                            <strong>{selectedLog?.role || '-'}</strong>
                        </div>
                        <div>
                            <span>IP Address</span>
                            <strong>{selectedLog?.ip_address || '127.0.0.1'}</strong>
                        </div>
                    </div>
                    <p>{selectedLog?.details || 'Select a case from the table below to inspect the audit payload.'}</p>
                </div>

                <div className="surface-card case-actions-card">
                    <span className="page-eyebrow">Case Actions</span>
                    <h2>Resolve the case outcome</h2>
                    <div className="case-actions-buttons">
                        <button className="case-outline-button case-outline-button--danger" type="button">Confirm Fraud</button>
                        <button className="case-outline-button case-outline-button--success" type="button">False Positive</button>
                    </div>
                </div>
            </section>

            <div className="surface-card case-table-card">
                <div className="case-table-card__header">
                    <div>
                        <span className="page-eyebrow">Case Queue</span>
                        <h2>Recent alerts and audit events</h2>
                    </div>
                    <div className="case-search">
                        <Search size={16} />
                        <input
                            className="fintech-input"
                            type="text"
                            placeholder="Search cases..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                </div>

                <div className="case-table-wrap">
                    <table className="case-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Operator</th>
                                <th>Role</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => (
                                <tr
                                    key={log.id}
                                    className={selectedLog?.id === log.id ? 'selected' : ''}
                                    onClick={() => setSelectedLogId(log.id)}
                                >
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

            <GraphSection
                eyebrow="Timeline Graph"
                title="Audit trail timeline"
                subtitle="A full-width timeline view that keeps the case history visible while you classify outcomes."
            >
                <ResponsiveContainer width="100%" height={360}>
                    <AreaChart data={timelineRows}>
                        <defs>
                            <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#533afd" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="#533afd" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2fb" />
                        <XAxis dataKey="label" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="intensity" stroke="#533afd" fill="url(#timelineFill)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </GraphSection>
        </div>
    );
};

export default AuditLogs;
