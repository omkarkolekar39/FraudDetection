import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Label
} from 'recharts';
import './AutoencoderChart.css';

const COLORS = { high: '#FF4D4F', medium: '#FAAD14', low: '#52C41A' };

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cat = d.category || 'low';
    return (
        <div className="ae-tooltip">
            <div className="ae-tooltip-id">
                RECORD <strong>#{d.row_num}</strong>
                {d.account_id && d.account_id !== String(d.row_num - 1) && (
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {d.account_id}</span>
                )}
            </div>
            <div className="ae-tooltip-score" style={{ color: COLORS[cat] }}>
                Loss: <strong>{d.ae_error?.toFixed(5)}</strong>
            </div>
            <span className="ae-tooltip-badge" style={{ background: COLORS[cat] }}>
                {cat.toUpperCase()} RISK
            </span>
        </div>
    );
};

/**
 * AutoencoderChart — pure renderer.
 * Receives pre-sliced data from Analytics.jsx. No internal state.
 */
const AutoencoderChart = ({ data = [] }) => {
    // Pre-compute dot color lookup for performance
    const colorMap = useMemo(() => {
        const map = {};
        data.forEach((d, i) => { map[i] = COLORS[d.category] ?? '#52C41A'; });
        return map;
    }, [data]);

    const showDots = data.length <= 400;

    if (!data || data.length === 0) {
        return (
            <div className="ae-chart-wrapper-3d">
                <div className="ae-empty-state">NEURAL PIPELINE STANDBY...</div>
            </div>
        );
    }

    return (
        <div className="ae-chart-wrapper-3d">
            <div className="ae-chart-header">
                <h3 className="ae-chart-title">NEURAL RECONSTRUCTION MAP</h3>
                <p className="ae-chart-subtitle">
                    Reconstruction loss per record — spikes indicate anomalous transactions
                </p>
            </div>

            <div className="ae-recharts-container">
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data} margin={{ top: 20, right: 30, bottom: 70, left: 65 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                        <XAxis dataKey="row_num" tick={false} axisLine={{ stroke: '#e2e8f0' }}>
                            <Label
                                value="Record # (1 to N)"
                                offset={-45}
                                position="insideBottom"
                                fill="#1e293b"
                                fontWeight={800}
                                fontSize={12}
                            />
                        </XAxis>

                        <YAxis
                            stroke="#64748b"
                            fontSize={11}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                            tickFormatter={v => v.toFixed(4)}
                        >
                            <Label
                                value="Reconstruction Loss (MSE)"
                                angle={-90}
                                position="insideLeft"
                                offset={-50}
                                style={{ textAnchor: 'middle', fill: '#1e293b', fontWeight: 800, fontSize: 12 }}
                            />
                        </YAxis>

                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#9333ea', strokeWidth: 1.5, strokeDasharray: '5 5' }}
                        />

                        <Line
                            type="monotone"
                            dataKey="ae_error"
                            stroke="#9333ea"
                            strokeWidth={showDots ? 1.5 : 1}
                            dot={showDots
                                ? (props) => {
                                    const { cx, cy, index } = props;
                                    return (
                                        <circle
                                            key={index}
                                            cx={cx} cy={cy} r={3}
                                            fill={colorMap[index] ?? '#52C41A'}
                                            strokeWidth={0}
                                        />
                                    );
                                }
                                : false
                            }
                            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="ae-chart-footer">
                <div className="ae-meta-info">ENGINE: TENSORFLOW AUTOENCODER</div>
                <div className="ae-meta-info">{data.length} RECORDS RENDERED</div>
            </div>
        </div>
    );
};

export default AutoencoderChart;
