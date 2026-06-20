import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, Label, ReferenceLine
} from 'recharts';
import './RiskScoreChart.css';

const COLORS = { high: '#FF4D4F', medium: '#FAAD14', low: '#52C41A' };

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cat = d.category || 'low';
    return (
        <div className="rs-tooltip">
            <div className="rs-tooltip-id">
                RECORD <strong>#{d.row_num}</strong>
                {d.account_id && d.account_id !== String(d.row_num - 1) && (
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {d.account_id}</span>
                )}
            </div>
            <div className="rs-tooltip-score" style={{ color: COLORS[cat] }}>
                Score: <strong>{d.blended_score?.toFixed(1)}</strong>
            </div>
            <div className="rs-tooltip-cat" style={{ background: COLORS[cat] }}>
                {cat.toUpperCase()} RISK
            </div>
        </div>
    );
};

/**
 * RiskScoreChart — pure renderer.
 * Receives pre-sliced data from Analytics.jsx. No internal state.
 */
const RiskScoreChart = ({ data = [], highThresh = 70, medThresh = 30 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="rs-chart-wrapper">
                <div className="rs-empty-state">NEURAL PIPELINE STANDBY...</div>
            </div>
        );
    }

    return (
        <div className="rs-chart-wrapper">
            <div className="rs-chart-header">
                <h3 className="rs-chart-title">BLENDED RISK SCORE MAP</h3>
                <p className="rs-chart-subtitle">
                    Per-record composite risk (0–100) from AE + Isolation Forest fusion
                </p>
            </div>

            <div className="rs-recharts-container">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 60, bottom: 55, left: 65 }}
                        barCategoryGap="2%"
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                        <XAxis dataKey="row_num" tick={false} axisLine={{ stroke: '#e2e8f0' }}>
                            <Label
                                value="Record # (1 to N)"
                                offset={-35}
                                position="insideBottom"
                                fill="#1e293b"
                                fontWeight={800}
                                fontSize={12}
                            />
                        </XAxis>

                        <YAxis
                            domain={[0, 100]}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                            fontSize={11}
                            stroke="#64748b"
                        >
                            <Label
                                value="Blended Risk Score (0–100)"
                                angle={-90}
                                position="insideLeft"
                                offset={-50}
                                style={{ textAnchor: 'middle', fill: '#1e293b', fontWeight: 800, fontSize: 12 }}
                            />
                        </YAxis>

                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: 'rgba(147,51,234,0.04)' }}
                        />

                        <ReferenceLine
                            y={highThresh}
                            stroke="#ef4444"
                            strokeDasharray="5 3"
                            label={{
                                value: `HIGH ≥${highThresh}`,
                                fill: '#ef4444', fontSize: 10,
                                fontWeight: 800, position: 'right'
                            }}
                        />
                        <ReferenceLine
                            y={medThresh}
                            stroke="#f59e0b"
                            strokeDasharray="5 3"
                            label={{
                                value: `MED ≥${medThresh}`,
                                fill: '#f59e0b', fontSize: 10,
                                fontWeight: 800, position: 'right'
                            }}
                        />

                        <Bar dataKey="blended_score" maxBarSize={14} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                            {data.map((entry, i) => (
                            <Cell key={`rs-cell-${i}`} fill={COLORS[entry.category] ?? '#52C41A'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="rs-chart-footer">
                <div className="rs-meta-info">ENGINE: AE (60%) + ISO FOREST (40%) FUSION</div>
                <div className="rs-meta-info">{data.length} RECORDS RENDERED</div>
            </div>
        </div>
    );
};

export default RiskScoreChart;
