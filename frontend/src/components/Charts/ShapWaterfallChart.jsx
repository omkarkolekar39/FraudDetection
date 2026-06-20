import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label
} from 'recharts';
import './ShapWaterfallChart.css';

/**
 * SHAP WATERFALL CHART (XAI)
 * Logic: Explains local feature importance for a specific account.
 * Traffic Light: Red (Increases Fraud Risk), Green (Decreases Risk/Normalizes).
 */
const ShapWaterfallChart = ({ data }) => {

    // Traffic Light Resolver for Feature Impact
    const getImpactColor = (impact) => {
    return impact > 0 ? '#FF4D4F' : '#52C41A';
    };

    const chartData = data && data.length > 0 ? data : [];

    return (
        <div className="sw-chart-wrapper-3d">
            <div className="sw-recharts-container">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="rgba(255,255,255,0.08)" />

                        <XAxis
                            type="number"
                            stroke="rgba(255,255,255,0.64)"
                            fontSize={11}
                        >
                            <Label value="SHAP Impact Value (Directional)" offset={-10} position="insideBottom" fill="rgba(255,255,255,0.72)" fontWeight={400} />
                        </XAxis>

                        <YAxis
                            dataKey="feature"
                            type="category"
                            tick={{ fill: '#ffffff', fontSize: 11, fontWeight: 400 }}
                            width={100}
                        />

                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                            contentStyle={{
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: '#10153e',
                                color: '#ffffff',
                                boxShadow: 'rgba(0,0,0,0.34) 0px 18px 36px -18px',
                                padding: '12px'
                            }}
                            formatter={(value) => [value.toFixed(4), "Impact Score"]}
                        />

                        {/* Baseline Reference Line */}
                        <ReferenceLine x={0} stroke="rgba(255,255,255,0.4)" strokeWidth={2} />

                        <Bar dataKey="impact" radius={[0, 5, 5, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={getImpactColor(entry.impact)}
                                    className="sw-bar-item"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="sw-chart-footer">
                <div className="sw-legend">
                    <div className="sw-legend-item">
                        <span className="sw-dot red"></span>
                        <span>Increases Risk</span>
                    </div>
                    <div className="sw-legend-item">
                        <span className="sw-dot green"></span>
                        <span>Decreases Risk</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShapWaterfallChart;
