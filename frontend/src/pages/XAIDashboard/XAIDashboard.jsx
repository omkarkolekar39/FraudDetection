import React, { useEffect, useState } from 'react';
import { BrainCircuit, Info, ShieldAlert, BarChartHorizontal } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getGlobalXai } from '../../api/mlEndpoints';
import './XAIDashboard.css';

function GlobalXaiTooltip({ active, payload }) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="xai-custom-tooltip">
            <p className="tooltip-feature">{payload[0].payload.feature}</p>
            <p className="tooltip-impact">
                Average Impact: <strong>{payload[0].value.toFixed(3)}</strong>
            </p>
        </div>
    );
}

const XAIDashboard = () => {
    const [globalShapData, setGlobalShapData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadGlobalXai = async () => {
            try {
                const response = await getGlobalXai();
                setGlobalShapData(Array.isArray(response.features) ? response.features : []);
            } catch (requestError) {
                setError(
                    requestError.response?.data?.detail ||
                    requestError.message ||
                    'Unable to load the global feature impact summary.',
                );
            } finally {
                setIsLoading(false);
            }
        };

        void loadGlobalXai();
    }, []);

    return (
        <div className="xai-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Explainable AI (XAI)</h1>
                    <p className="page-subtitle">Global feature importance generated from the uploaded dataset itself.</p>
                </div>
                <div className="header-icon-wrapper blue">
                    <BrainCircuit size={32} />
                </div>
            </header>

            <div className="xai-info-grid">
                <div className="info-card">
                    <div className="info-icon-wrapper">
                        <Info size={24} />
                    </div>
                    <div>
                        <h3>What is this view?</h3>
                        <p>
                            This chart aggregates feature impact across the processed dataset so the column names always match the real CSV schema.
                        </p>
                    </div>
                </div>

                <div className="info-card">
                    <div className="info-icon-wrapper warning">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h3>How should Admins interpret it?</h3>
                        <p>
                            Larger bars indicate columns that contribute more heavily to anomaly separation, helping you understand which fields are driving risk across the portfolio.
                        </p>
                    </div>
                </div>
            </div>

            <section className="global-chart-section">
                <div className="chart-header">
                    <h2><BarChartHorizontal size={20} /> Aggregate Feature Importance (Top 10)</h2>
                </div>

                <div className="chart-wrapper">
                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Compiling global XAI matrix...</p>
                        </div>
                    ) : error ? (
                        <div className="loading-state">
                            <p>{error}</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={globalShapData}
                                layout="vertical"
                                margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical stroke="#e2e8f0" />
                                <XAxis
                                    type="number"
                                    tick={{ fill: '#64748b' }}
                                    label={{ value: 'Mean Absolute Feature Impact', position: 'bottom', fill: '#64748b' }}
                                />
                                <YAxis
                                    dataKey="feature"
                                    type="category"
                                    tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 500 }}
                                    width={180}
                                />
                                <Tooltip cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} content={<GlobalXaiTooltip />} />
                                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                                    {globalShapData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${entry.feature}-${index}`}
                                            fill={index < 3 ? '#0f766e' : '#2dd4bf'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>
        </div>
    );
};

export default XAIDashboard;
