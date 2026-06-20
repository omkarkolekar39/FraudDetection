import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import GraphSection from '../../components/UI/GraphSection';
import RiskBadge from '../../components/UI/RiskBadge';
import { getRiskDirectory } from '../../api/mlEndpoints';
import './RiskDirectory.css';

const PAGE_SIZE = 100;

const RiskDirectory = () => {
    const [selectedTier, setSelectedTier] = useState('High');
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const loadDirectoryPage = useCallback(async (offset, reset = false) => {
        if (reset) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const response = await getRiskDirectory(selectedTier, {
                offset,
                limit: PAGE_SIZE,
            });
            const nextRecords = response.data || [];

            setRecords((current) => (reset ? nextRecords : [...current, ...nextRecords]));
            setHasMore(Boolean(response.has_more));
            setTotalCount(Number(response.total_count || nextRecords.length));
        } catch (error) {
            console.error('Directory sync failure:', error);
        } finally {
            if (reset) {
                setIsLoading(false);
            } else {
                setIsLoadingMore(false);
            }
        }
    }, [selectedTier]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadDirectoryPage(0, true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [loadDirectoryPage]);

    const filteredRecords = useMemo(() => records.filter((row) =>
        Object.values(row).some((value) =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase()),
        )
    ), [records, searchTerm]);

    const chartRows = useMemo(() => {
        const counts = { High: 0, Medium: 0, Low: 0 };
        filteredRecords.forEach((row) => {
            const category = String(row.category || '').toLowerCase();
            if (category.includes('high')) counts.High += 1;
            else if (category.includes('med')) counts.Medium += 1;
            else counts.Low += 1;
        });

        return [
        { label: 'High Risk', value: counts.High, fill: '#FF4D4F' },
        { label: 'Medium Risk', value: counts.Medium, fill: '#FAAD14' },
        { label: 'Low Risk', value: counts.Low, fill: '#52C41A' },
        ];
    }, [filteredRecords]);

    const handleScroll = async (event) => {
        const element = event.currentTarget;
        const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 80;

        if (!nearBottom || isLoading || isLoadingMore || !hasMore) {
            return;
        }

        await loadDirectoryPage(records.length, false);
    };

    return (
        <div className="page-shell transactions-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Transactions</span>
                    <h1 className="page-title">A large, searchable transaction workspace.</h1>
                    <p className="page-subtitle">
                        The transaction table stays the primary focus, while the graph below gives a fast read on the currently loaded risk mix.
                    </p>
                </div>
            </header>

            <section className="transactions-toolbar">
                <div className="transactions-tier-tabs">
                    {['High', 'Medium', 'Low'].map((tier) => (
                        <button
                            key={tier}
                            className={`transactions-tier-tab ${selectedTier === tier ? 'active' : ''}`}
                            onClick={() => setSelectedTier(tier)}
                            type="button"
                        >
                            {tier}
                        </button>
                    ))}
                </div>

                <div className="transactions-search">
                    <Search size={16} />
                    <input
                        className="fintech-input"
                        type="text"
                        placeholder="Search loaded transactions..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
            </section>

            <div className="table-surface transactions-table-shell">
                {isLoading ? (
                    <div className="transactions-loader">
                        <RefreshCw className="spinning" size={24} />
                        <p>Loading transactions...</p>
                    </div>
                ) : (
                    <div className="transactions-scroll" onScroll={(event) => { void handleScroll(event); }}>
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Record ID</th>
                                    <th>Row</th>
                                    <th>Risk Score</th>
                                    <th>Risk Tier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((row) => (
                                    <tr key={`${row.record_id}-${row.row_num}`}>
                                        <td>{row.record_id || `RECORD ${row.row_num}`}</td>
                                        <td>{row.row_num}</td>
                                        <td>{Number(row.risk_score || 0).toFixed(2)}</td>
                                        <td><RiskBadge value={row.category} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {isLoadingMore ? (
                            <div className="directory-inline-loader">
                                <RefreshCw className="spinning" size={18} />
                                <span>Loading next 100 records...</span>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <footer className="transactions-footer">
                <span>Loaded {records.length} of {totalCount} records</span>
                <span>Visible after search: {filteredRecords.length}</span>
            </footer>

            <GraphSection
                eyebrow="Transaction Graph"
                title="Loaded transaction distribution"
                subtitle="A full-width view of the current transaction window, using the same risk colors as the rest of the product."
            >
                <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={chartRows}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2fb" />
                        <XAxis dataKey="label" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {chartRows.map((entry) => (
                                <Cell key={entry.label} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </GraphSection>
        </div>
    );
};

export default RiskDirectory;
