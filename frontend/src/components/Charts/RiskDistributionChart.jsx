import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, Legend, Label
} from 'recharts';
import './RiskDistributionChart.css';

function CustomTooltip({ active, payload }) {
    if (active && payload && payload.length) {
        return (
            <div className="custom-chart-tooltip-white animate-pop">
                <p className="tooltip-label-white">RISK LEVEL</p>
                <p className="tooltip-value-white">{payload[0].payload.name}</p>
                <p className="tooltip-count-white">{`Total Records: ${payload[0].value.toLocaleString()}`}</p>
                <div className="tooltip-accent-line" style={{ backgroundColor: payload[0].payload.fill }}></div>
            </div>
        );
    }
    return null;
}

const RiskDistributionChart = ({ data }) => {
    const [activeIndex, setActiveIndex] = useState(null);

    return (
        <div className="chart-card-white">
            <div className="chart-header-white">
                <h3 className="chart-title-white">FULL PORTFOLIO RISK DISTRIBUTION</h3>
                <p className="chart-subtitle-white">Comprehensive anomaly quantification across all processed records</p>
            </div>

            <div className="chart-viewport-white">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
                        onMouseMove={(state) => {
                            if (state.activeTooltipIndex !== undefined) {
                                setActiveIndex(state.activeTooltipIndex);
                            }
                        }}
                        onMouseLeave={() => setActiveIndex(null)}
                    >
                        {/* Grid lines set to a very light gray for the white background */}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                        <XAxis
                            dataKey="name"
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                        >
                            <Label
                                value="Risk Classification Tiers"
                                offset={-45}
                                position="insideBottom"
                                fill="#0f172a"
                                fontSize={13}
                                fontWeight={800}
                            />
                        </XAxis>

                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                        >
                            <Label
                                value="Total Records Detected"
                                angle={-90}
                                position="insideLeft"
                                style={{ textAnchor: 'middle', fill: '#0f172a', fontSize: 13, fontWeight: 800 }}
                            />
                        </YAxis>

                        <Tooltip content={<CustomTooltip />} cursor={false} />

                        <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '30px', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}
                        />

                        <Bar
                            name="Anomaly Count"
                            dataKey="value"
                            radius={[10, 10, 0, 0]}
                            barSize={65}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.fill}
                                    style={{
                                        // Hover Effect: Glowing drop shadow and elevation
                                        filter: activeIndex === index
                                            ? `drop-shadow(0px 8px 20px ${entry.fill}66)`
                                            : 'none',
                                        // Non-hovered bars fade slightly to spotlight the active bar
                                        opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
                                        transform: activeIndex === index ? 'translateY(-8px)' : 'translateY(0)',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        cursor: 'pointer',
                                        transformOrigin: 'bottom'
                                    }}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RiskDistributionChart;
