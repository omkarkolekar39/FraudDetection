import React, { useMemo } from 'react';
import {
    CartesianGrid,
    Cell,
    Label,
    Legend,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from 'recharts';
import './IsolationForestChart.css';

const COLORS = { high: '#FF4D4F', medium: '#FAAD14', low: '#52C41A' };
const LANE_BASE = { low: 0.18, medium: 0.56, high: 0.86 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildDeterministicJitter = (seed) => {
    const raw = Math.sin(seed * 12.9898) * 43758.5453;
    return (raw - Math.floor(raw)) - 0.5;
};

const buildPlotData = (data) => {
    if (!data.length) return [];

    const scores = data.map((entry) => Number(entry.if_score || 0));
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const spread = Math.max(maxScore - minScore, 0.000001);

    return data.map((entry, index) => {
        const category = entry.category || 'low';
        const normalizedScore = (Number(entry.if_score || 0) - minScore) / spread;
        const jitter = buildDeterministicJitter((entry.row_num || index + 1) * 1.17) * 0.12;
        const outlierPush = normalizedScore * 0.18;
        const x = clamp((LANE_BASE[category] ?? LANE_BASE.low) + outlierPush + jitter, 0.05, 0.98);
        const y = Number(entry.if_score || 0);
        const bubbleSize = category === 'high' ? 120 : category === 'medium' ? 88 : 64;

        return {
            ...entry,
            plot_x: Number(x.toFixed(4)),
            plot_y: y,
            plot_size: bubbleSize,
            normalized_score: normalizedScore,
        };
    });
};

const buildYDomain = (plotData) => {
    if (!plotData.length) return [0, 1];
    const values = plotData.map((entry) => entry.plot_y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.16, 0.02);
    return [Math.max(0, min - padding), max + padding];
};

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cat = d.category || 'low';
    return (
        <div className="if-tooltip">
            <div className="if-tooltip-id">
                RECORD <strong>#{d.row_num}</strong>
                {d.account_id && d.account_id !== String(d.row_num - 1) && (
                    <span className="if-tooltip-account"> · {d.account_id}</span>
                )}
            </div>
            <div className="if-tooltip-score" style={{ color: COLORS[cat] }}>
                Score: <strong>{d.if_score?.toFixed(4)}</strong>
            </div>
            <div className="if-tooltip-separation">
                Separation: <strong>{(d.normalized_score * 100).toFixed(1)}%</strong>
            </div>
            <span className="if-tooltip-badge" style={{ background: COLORS[cat] }}>
                {cat.toUpperCase()} RISK
            </span>
        </div>
    );
};

const IsolationForestChart = ({ data = [] }) => {
    const plotData = useMemo(() => buildPlotData(data), [data]);
    const yDomain = useMemo(() => buildYDomain(plotData), [plotData]);

    if (!plotData.length) {
        return (
            <div className="if-chart-wrapper-3d">
                <div className="if-empty-state">SYNCHRONIZING NEURAL TOPOLOGY...</div>
            </div>
        );
    }

    const totalRows = plotData.length;

    return (
        <div className="if-chart-wrapper-3d">
            <div className="if-chart-header">
                <h3 className="if-chart-title">ISOLATION AGREEMENT MAPPING</h3>
                <p className="if-chart-subtitle">
                    Outlier separation map — dense low-risk cluster on the left, medium drift in the middle, strongest outliers pushed away to the right.
                </p>
            </div>

            <div className="if-recharts-container">
                <ResponsiveContainer width="100%" height={420}>
                    <ScatterChart margin={{ top: 24, right: 30, bottom: 70, left: 65 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe8ee" />

                        <XAxis
                            type="number"
                            dataKey="plot_x"
                            domain={[0, 1]}
                            tick={false}
                            axisLine={{ stroke: '#d7e3ea' }}
                        >
                            <Label
                                value="Isolation Spread"
                                offset={-44}
                                position="insideBottom"
                                fill="#1e293b"
                                fontWeight={800}
                                fontSize={12}
                            />
                        </XAxis>

                        <YAxis
                            type="number"
                            dataKey="plot_y"
                            domain={yDomain}
                            tickLine={false}
                            axisLine={{ stroke: '#d7e3ea' }}
                            tickFormatter={(value) => value.toFixed(3)}
                        >
                            <Label
                                value="Isolation Forest Anomaly Score"
                                angle={-90}
                                position="insideLeft"
                                offset={-50}
                                style={{ textAnchor: 'middle', fill: '#1e293b', fontWeight: 800, fontSize: 12 }}
                            />
                        </YAxis>

                        <ZAxis type="number" dataKey="plot_size" range={[60, 140]} />

                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                        <Legend
                            verticalAlign="top"
                            align="right"
                            wrapperStyle={{ paddingBottom: '30px' }}
                            content={() => (
                                <div className="if-custom-legend-row">
                                    <div className="if-leg-item"><span className="dot red" /> HIGH RISK OUTLIERS</div>
                                    <div className="if-leg-item"><span className="dot yellow" /> MEDIUM DRIFT</div>
                                    <div className="if-leg-item"><span className="dot green" /> LOW RISK CLUSTER</div>
                                </div>
                            )}
                        />

                        <Scatter name="Isolation Spread" data={plotData} isAnimationActive={false}>
                            {plotData.map((entry, i) => (
                                <Cell
                                    key={`cell-${i}`}
                                    fill={COLORS[entry.category] ?? '#52C41A'}
                                    fillOpacity={entry.category === 'high' ? 0.95 : entry.category === 'medium' ? 0.85 : 0.72}
                                    stroke={entry.category === 'high' ? '#991b1b' : entry.category === 'medium' ? '#854d0e' : '#166534'}
                                    strokeWidth={entry.category === 'high' ? 1.6 : 1}
                                />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            <div className="if-chart-footer">
                <div className="if-meta-info">ALGORITHM: SCIKIT-LEARN ISOLATION FOREST</div>
                <div className="if-meta-info">{totalRows} RENDERED POINTS</div>
            </div>
        </div>
    );
};

export default IsolationForestChart;
