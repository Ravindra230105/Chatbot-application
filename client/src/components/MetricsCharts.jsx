import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '../utils/constants';
import { formatDuration, formatMinute, formatNumber } from '../utils/format';

const CHART_HEIGHT = 220;

function Legend({ items }) {
    return (
        <div className="legend">
            {items.map(item => (
                <span key={item.label}>
                    <i style={{ background: item.color }} />
                    {item.label}
                </span>
            ))}
        </div>
    );
}

export default function MetricsCharts({ points }) {
    const axisStyle = {
        stroke   : CHART_COLORS.axis,
        tick     : { fill: CHART_COLORS.axis, fontSize: 11 },
        tickLine : false
    };

    return (
        <div className="chart-grid">
            <div className="card">
                <div className="card-title">Throughput and errors</div>
                <div className="card-subtitle">Requests per minute</div>

                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <LineChart data={points} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis dataKey="minute" tickFormatter={formatMinute} minTickGap={40} {...axisStyle} />
                        <YAxis allowDecimals={false} {...axisStyle} />
                        <Tooltip labelFormatter={formatMinute} formatter={value => formatNumber(value)} />
                        <Line
                            type="monotone"
                            dataKey="requests"
                            name="Requests"
                            stroke={CHART_COLORS.primary}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="errors"
                            name="Errors"
                            stroke={CHART_COLORS.danger}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>

                <Legend
                    items={[
                        { label: 'Requests', color: CHART_COLORS.primary },
                        { label: 'Errors', color: CHART_COLORS.danger }
                    ]}
                />
            </div>

            <div className="card">
                <div className="card-title">Latency</div>
                <div className="card-subtitle">Average response and first token time per minute</div>

                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                    <LineChart data={points} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis dataKey="minute" tickFormatter={formatMinute} minTickGap={40} {...axisStyle} />
                        <YAxis {...axisStyle} />
                        <Tooltip labelFormatter={formatMinute} formatter={value => formatDuration(value)} />
                        <Line
                            type="monotone"
                            dataKey="avgLatencyMs"
                            name="Total"
                            stroke={CHART_COLORS.primary}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="avgFirstTokenMs"
                            name="First token"
                            stroke={CHART_COLORS.accent}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            connectNulls={false}
                        />
                    </LineChart>
                </ResponsiveContainer>

                <Legend
                    items={[
                        { label: 'Total latency', color: CHART_COLORS.primary },
                        { label: 'Time to first token', color: CHART_COLORS.accent }
                    ]}
                />
            </div>
        </div>
    );
}
