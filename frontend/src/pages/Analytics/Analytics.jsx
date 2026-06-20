import React, { useEffect, useMemo, useState } from 'react';
import {
    Binary, BrainCircuit, RefreshCcw,
    Info, ShieldCheck, Zap, BarChart2, Shuffle, ListFilter, Play,
} from 'lucide-react';

import AutoencoderChart from '../../components/Charts/AutoencoderChart';
import IsolationForestChart from '../../components/Charts/IsolationForestChart';
import RiskScoreChart from '../../components/Charts/RiskScoreChart';
import { getGraphsData } from '../../api/mlEndpoints';

import './Analytics.css';

const MAX_RENDERED_RECORDS = 200;

const EMPTY_WINDOW = {
    mode: 'summary',
    from_record: 1,
    to_record: 0,
    total_in_window: 0,
    rendered_records: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    limited: false,
};

const Analytics = () => {
    const [activeTab, setActiveTab] = useState('risk');
    const [viewMode, setViewMode] = useState('sample');
    const [fromInput, setFromInput] = useState('1');
    const [toInput, setToInput] = useState(String(MAX_RENDERED_RECORDS));
    const [isLoading, setIsLoading] = useState(true);
    const [applyMessage, setApplyMessage] = useState('');
    const [chartData, setChartData] = useState({
        ae: [],
        ifo: [],
        risk: [],
    });
    const [meta, setMeta] = useState({});
    const [thresholds, setThresholds] = useState({ high: 70, medium: 30 });
    const [windowMeta, setWindowMeta] = useState(EMPTY_WINDOW);

    async function fetchAnalytics(options = {}) {
        const {
            mode = 'summary',
            start,
            end,
        } = options;

        setIsLoading(true);
        try {
            const response = await getGraphsData({
                includeRaw: true,
                mode,
                start,
                end,
                limit: MAX_RENDERED_RECORDS,
            });

            if (response.status === 'success' || response.status === 'waiting') {
                const totalRecords = Number(response.metadata?.total_records || 0);
                const nextWindowMeta = response.window_metadata || EMPTY_WINDOW;

                setChartData({
                    ae: response.ae_errors_raw || [],
                    ifo: response.if_scores_raw || [],
                    risk: response.risk_scores_raw || [],
                });
                setMeta(response.metadata || {});
                setThresholds({
                    high: response.metadata?.high_threshold ?? 70,
                    medium: response.metadata?.medium_threshold ?? 30,
                });
                setWindowMeta(nextWindowMeta);

                if (mode === 'sample') {
                    setFromInput('1');
                    setToInput(String(Math.min(MAX_RENDERED_RECORDS, totalRecords || MAX_RENDERED_RECORDS)));
                }

                return { response, nextWindowMeta };
            }
        } catch (error) {
            console.error('Analytics sync error:', error);
        } finally {
            setTimeout(() => setIsLoading(false), 250);
        }

        return null;
    }

    useEffect(() => {
        const boot = async () => {
            const result = await fetchAnalytics({ mode: 'sample' });
            const nextWindowMeta = result?.nextWindowMeta;
            if (nextWindowMeta) {
                setApplyMessage(
                    nextWindowMeta.limited
                        ? `Showing ${nextWindowMeta.rendered_records} sampled chart points.`
                        : `Showing ${nextWindowMeta.rendered_records} sampled records.`,
                );
            }
        };

        void boot();
    }, []);

    const total = Number(meta.total_records || 0);

    const rangePreview = useMemo(() => {
        const fallbackTo = total > 0 ? total : 1;
        const parsedFrom = Math.max(1, Math.min(Number.parseInt(fromInput, 10) || 1, fallbackTo));
        const parsedTo = Math.max(parsedFrom, Math.min(Number.parseInt(toInput, 10) || parsedFrom, fallbackTo));
        return { from: parsedFrom, to: parsedTo };
    }, [fromInput, toInput, total]);

    async function applyRangeWindow() {
        if (!total) {
            return;
        }

        const result = await fetchAnalytics({
            mode: 'range',
            start: rangePreview.from,
            end: rangePreview.to,
        });
        const nextWindowMeta = result?.nextWindowMeta;

        if (nextWindowMeta) {
            setApplyMessage(
                nextWindowMeta.limited
                    ? `Analyzed records ${rangePreview.from} to ${rangePreview.to}. Rendering ${nextWindowMeta.rendered_records} sampled points from ${nextWindowMeta.total_in_window} selected records.`
                    : `Analyzing records ${rangePreview.from} to ${rangePreview.to}.`,
            );
        }
    }

    if (isLoading) {
        return (
            <div className="analytics-loading-overlay">
                <div className="loader-box">
                    <RefreshCcw className="spin-icon" size={40} color="#0f766e" />
                    <p className="loading-text">DECODING NEURAL TOPOLOGY...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-page-wrapper animate-slideUp">
            <header className="analytics-header-3d">
                <div className="header-info-group">
                    <div className="title-row">
                        <Zap size={24} fill="#0f766e" color="#0f766e" />
                        <h1 className="analytics-main-title">ML Engine Diagnostics</h1>
                    </div>
                    <p className="analytics-description">
                        Inspect autoencoder loss, isolation scores, and blended risk using either a random sample or an applied index window.
                    </p>
                </div>

                <div className="analytics-hud-row">
                    <div className="hud-pill red-pill">
                        <span className="hud-count">{meta.total_high_risk ?? 0}</span>
                        <span className="hud-label">HIGH</span>
                    </div>
                    <div className="hud-pill yellow-pill">
                        <span className="hud-count">{meta.total_medium_risk ?? 0}</span>
                        <span className="hud-label">MEDIUM</span>
                    </div>
                    <div className="hud-pill green-pill">
                        <span className="hud-count">{meta.total_low_risk ?? 0}</span>
                        <span className="hud-label">LOW</span>
                    </div>
                    <button
                        className="sync-engine-btn"
                        onClick={() => {
                            void fetchAnalytics({ mode: viewMode === 'range' ? 'range' : 'sample', start: rangePreview.from, end: rangePreview.to });
                        }}
                        type="button"
                    >
                        <RefreshCcw size={14} /> Re-Sync
                    </button>
                </div>
            </header>

            <div className="analytics-controls-bar">
                <div className="view-mode-toggle">
                    <button
                        className={`mode-btn ${viewMode === 'sample' ? 'mode-active' : ''}`}
                        onClick={async () => {
                            setViewMode('sample');
                            const result = await fetchAnalytics({ mode: 'sample' });
                            const nextWindowMeta = result?.nextWindowMeta;
                            if (nextWindowMeta) {
                                setApplyMessage(
                                    nextWindowMeta.limited
                                        ? `Showing ${nextWindowMeta.rendered_records} sampled chart points.`
                                        : `Showing ${nextWindowMeta.rendered_records} sampled records.`,
                                );
                            }
                        }}
                        type="button"
                    >
                        <Shuffle size={14} />
                        Random {MAX_RENDERED_RECORDS}
                    </button>
                    <button
                        className={`mode-btn ${viewMode === 'range' ? 'mode-active' : ''}`}
                        onClick={() => setViewMode('range')}
                        type="button"
                    >
                        <ListFilter size={14} />
                        Index Range
                    </button>
                </div>

                <div className={`range-inputs-group ${viewMode === 'range' ? 'range-active' : 'range-disabled'}`}>
                    <div className="range-field">
                        <label className="range-field-label">Record # From</label>
                        <input
                            type="number"
                            className="range-field-input"
                            min={1}
                            max={total || 1}
                            value={fromInput}
                            disabled={viewMode !== 'range'}
                            onChange={(event) => setFromInput(event.target.value)}
                        />
                    </div>
                    <span className="range-arrow">→</span>
                    <div className="range-field">
                        <label className="range-field-label">Record # To</label>
                        <input
                            type="number"
                            className="range-field-input"
                            min={1}
                            max={total || 1}
                            value={toInput}
                            disabled={viewMode !== 'range'}
                            onChange={(event) => setToInput(event.target.value)}
                        />
                    </div>
                    <span className="range-total-info">/ {total} records</span>
                    <button
                        className="apply-range-btn"
                        disabled={viewMode !== 'range' || total === 0}
                        onClick={() => {
                            void applyRangeWindow();
                        }}
                        type="button"
                    >
                        <Play size={14} />
                        Analyze Range
                    </button>
                </div>

                <div className="window-stats">
                    <span className="w-pill w-red">{windowMeta.high_count} High</span>
                    <span className="w-pill w-yellow">{windowMeta.medium_count} Med</span>
                    <span className="w-pill w-green">{windowMeta.low_count} Low</span>
                    <span className="w-pill w-gray">{windowMeta.rendered_records} Rendered</span>
                </div>
            </div>

            {viewMode === 'range' ? (
                <div className="analytics-apply-banner">
                    <span>
                        Active range: <strong>{windowMeta.from_record}</strong> to <strong>{windowMeta.to_record}</strong>
                    </span>
                    <span className="analytics-apply-hint">
                        Pending input: {rangePreview.from} to {rangePreview.to}
                    </span>
                    <span className="analytics-apply-hint">
                        Selected: {windowMeta.total_in_window} records
                    </span>
                    {applyMessage ? <span className="analytics-apply-state">{applyMessage}</span> : null}
                </div>
            ) : null}

            <nav className="analytics-nav-tabs">
                <button
                    className={`nav-tab-item ${activeTab === 'risk' ? 'active emerald' : ''}`}
                    onClick={() => setActiveTab('risk')}
                    type="button"
                >
                    <BarChart2 size={20} />
                    <div className="tab-text-stack">
                        <span className="tab-label">Risk Scores</span>
                        <span className="tab-sub">Blended score per record</span>
                    </div>
                </button>

                <button
                    className={`nav-tab-item ${activeTab === 'autoencoder' ? 'active purple' : ''}`}
                    onClick={() => setActiveTab('autoencoder')}
                    type="button"
                >
                    <Binary size={20} />
                    <div className="tab-text-stack">
                        <span className="tab-label">Autoencoder</span>
                        <span className="tab-sub">Neural reconstruction loss</span>
                    </div>
                </button>

                <button
                    className={`nav-tab-item ${activeTab === 'isolation' ? 'active indigo' : ''}`}
                    onClick={() => setActiveTab('isolation')}
                    type="button"
                >
                    <BrainCircuit size={20} />
                    <div className="tab-text-stack">
                        <span className="tab-label">Isolation Forest</span>
                        <span className="tab-sub">Outlier agreement mapping</span>
                    </div>
                </button>
            </nav>

            <main className="analytics-viewport">
                <div style={{ display: activeTab === 'risk' ? 'block' : 'none' }}>
                    <RiskScoreChart
                        data={chartData.risk}
                        highThresh={thresholds.high}
                        medThresh={thresholds.medium}
                    />
                    <div className="diagnostic-insight-card emerald-glow">
                        <div className="insight-icon-bg emerald-bg">
                            <BarChart2 size={20} color="#059669" />
                        </div>
                        <div className="insight-text">
                            <strong>Risk synthesis:</strong> every bar is the final blended score for a record.
                            Large ranges are analyzed in full, while the chart renders up to 200 points to keep the UI responsive.
                        </div>
                    </div>
                </div>

                <div style={{ display: activeTab === 'autoencoder' ? 'block' : 'none' }}>
                    <AutoencoderChart data={chartData.ae} />
                    <div className="diagnostic-insight-card purple-glow">
                        <div className="insight-icon-bg purple-bg">
                            <Info size={20} color="#9333ea" />
                        </div>
                        <div className="insight-text">
                            <strong>Reconstruction insight:</strong> spikes show records the neural network could not recreate cleanly.
                            Dot color still reflects the shared final risk tier used everywhere else in the app.
                        </div>
                    </div>
                </div>

                <div style={{ display: activeTab === 'isolation' ? 'block' : 'none' }}>
                    <IsolationForestChart data={chartData.ifo} />
                    <div className="diagnostic-insight-card indigo-glow">
                        <div className="insight-icon-bg indigo-bg">
                            <ShieldCheck size={20} color="#4f46e5" />
                        </div>
                        <div className="insight-text">
                            <strong>Spatial insight:</strong> shallow-node outliers surface as higher anomaly scores.
                            These dots are color-linked to the same blended risk categories shown in Analytics, Customer 360, and the Risk Directory.
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Analytics;
