import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileClock, Search } from 'lucide-react';

import { getAuditLogs } from '../../api/actionEndpoints';
import RiskBadge from '../../components/UI/RiskBadge';
import './Audits.css';

const getAuditRisk = (log) => {
    const text = `${log?.action || ''} ${log?.details || ''}`.toLowerCase();

    if (text.includes('reject') || text.includes('block') || text.includes('fraud') || text.includes('high')) {
        return 'high';
    }

    if (text.includes('approve') || text.includes('promote') || text.includes('analyst') || text.includes('medium')) {
        return 'medium';
    }

    return 'low';
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

const Audits = () => {
    const [auditRows, setAuditRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const loadAudits = async () => {
            try {
                const response = await getAuditLogs(120);
                setAuditRows(Array.isArray(response) ? response : []);
            } catch (error) {
                console.error('Failed to load audits:', error);
                setStatusMessage('Unable to load audit activity right now.');
            }
        };

        void loadAudits();
    }, []);

    const filteredAudits = useMemo(() => auditRows.filter((log) =>
        [log.action, log.details, log.username, log.role]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
    ), [auditRows, searchTerm]);

    return (
        <div className="page-shell audits-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Audits</span>
                    <h1 className="page-title">A fast audit view for recent control activity.</h1>
                    <p className="page-subtitle">
                        Review the latest actions, scan their operating risk level, and jump into the full case-management page when you need the complete trail.
                    </p>
                </div>
                <Link className="fintech-button-secondary" to="/audit-logs">
                    Open Case Management
                </Link>
            </header>

            {statusMessage ? <div className="audits-status">{statusMessage}</div> : null}

            <section className="surface-card audits-toolbar">
                <div className="audits-toolbar__copy">
                    <span className="page-eyebrow">Recent Activity</span>
                    <h2>Audit queue</h2>
                </div>

                <label className="audits-search">
                    <Search size={16} />
                    <input
                        className="fintech-input"
                        type="text"
                        placeholder="Search audits..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </label>
            </section>

            <section className="audits-list">
                {filteredAudits.map((log) => (
                    <article key={log.id} className="surface-card audit-list-item">
                        <div className="audit-list-item__icon">
                            <FileClock size={18} />
                        </div>
                        <div className="audit-list-item__body">
                            <strong>{log.action}</strong>
                            <p>{log.details || 'No additional details were recorded for this event.'}</p>
                            <span>{log.username} · {log.role} · {formatTimestamp(log.timestamp)}</span>
                        </div>
                        <RiskBadge value={getAuditRisk(log)} />
                    </article>
                ))}

                {!filteredAudits.length ? (
                    <div className="surface-card audits-empty-state">
                        No audit entries matched the current search.
                    </div>
                ) : null}
            </section>
        </div>
    );
};

export default Audits;
