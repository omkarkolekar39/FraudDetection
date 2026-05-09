import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { getGraphsData, getRiskDirectory } from '../../../api/mlEndpoints';
import GraphSection from '../../../components/UI/GraphSection';
import RiskBadge from '../../../components/UI/RiskBadge';
import './AnalystDashboard.css';

const AnalystDashboard = () => {
    const navigate = useNavigate();
    const [selectedTier, setSelectedTier] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [rows, setRows] = useState([]);
    const [trendRows, setTrendRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const [graphRes, highRes, mediumRes] = await Promise.all([
                    getGraphsData({ includeRaw: true, mode: 'sample', limit: 200 }),
                    getRiskDirectory('High', { offset: 0, limit: 50 }),
                    getRiskDirectory('Medium', { offset: 0, limit: 50 }),
                ]);

                const mergedRows = [...(highRes?.data || []), ...(mediumRes?.data || [])]
                    .sort((left, right) => Number(left.row_num || 0) - Number(right.row_num || 0));

                setRows(mergedRows);
                setTrendRows(graphRes?.risk_scores_raw || []);
            } catch (error) {
                console.error('Failed to load analyst dashboard:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, []);

    const filteredRows = useMemo(() => rows.filter((row) => {
        const matchesTier = selectedTier === 'All'
            ? true
            : String(row.category || '').toLowerCase().includes(selectedTier.toLowerCase());
        const matchesSearch = Object.values(row).some((value) =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase()),
        );
        return matchesTier && matchesSearch;
    }), [rows, searchTerm, selectedTier]);

    if (isLoading) {
        return (
            <div className="dashboard-loading-overlay">
                <p>Loading analyst dashboard...</p>
            </div>
        );
    }

    return (
        <div className="page-shell analyst-dashboard">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Analyst Dashboard</span>
                    <h1 className="page-title">A transaction-first analyst workflow.</h1>
                    <p className="page-subtitle">
                        Start with the working table, filter by severity, and keep the anomaly trend full-width below so the investigation signal stays visually dominant.
                    </p>
                </div>
            </header>

            <section className="analyst-layout-grid">
                <aside className="surface-card analyst-filter-panel">
                    <span className="page-eyebrow">Filters</span>
                    <h2>Working queue</h2>
                    <div className="analyst-tier-list">
                        {['All', 'High', 'Medium'].map((tier) => (
                            <button
                                key={tier}
                                className={`analyst-tier-chip ${selectedTier === tier ? 'active' : ''}`}
                                onClick={() => setSelectedTier(tier)}
                                type="button"
                            >
                                {tier}
                            </button>
                        ))}
                    </div>
                    <div className="analyst-search-box">
                        <Search size={16} />
                        <input
                            className="fintech-input"
                            type="text"
                            placeholder="Search transactions..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <p className="analyst-filter-copy">
                        Showing {filteredRows.length} prioritized records pulled from the active high and medium queues.
                    </p>
                </aside>

                <div className="table-surface analyst-table-wrap">
                    <table className="analyst-table">
                        <thead>
                            <tr>
                                <th>Record ID</th>
                                <th>Row</th>
                                <th>Risk Score</th>
                                <th>Risk Tier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row) => (
                                <tr
                                    key={`${row.record_id}-${row.row_num}`}
                                    onClick={() => navigate('/customer-360', { state: { prefillRecordId: row.record_id } })}
                                >
                                    <td>{row.record_id || row.account_id || `RECORD ${row.row_num}`}</td>
                                    <td>{row.row_num}</td>
                                    <td>{Number(row.risk_score || 0).toFixed(2)}</td>
                                    <td><RiskBadge value={row.category} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <GraphSection
                eyebrow="Trend Graph"
                title="Real-time anomaly detection trend"
                subtitle="A full-width record-by-record risk sweep that stays visually dominant below the working table."
            >
                <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={trendRows}>
                        <defs>
                            <linearGradient id="analystTrendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#533afd" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="#533afd" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2fb" />
                        <XAxis dataKey="row_num" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="blended_score" stroke="#533afd" fill="url(#analystTrendFill)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </GraphSection>
        </div>
    );
};

export default AnalystDashboard;
