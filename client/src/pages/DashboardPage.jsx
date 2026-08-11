import React, { useCallback, useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import MetricsCharts from '../components/MetricsCharts';
import LogsTable from '../components/LogsTable';
import { getOverview, getRecentLogs, getTimeseries } from '../api/metricsApi';
import { REFRESH_INTERVAL_MS, WINDOW_OPTIONS } from '../utils/constants';
import { formatDuration, formatNumber, formatPercent } from '../utils/format';

export default function DashboardPage() {
    const [windowMinutes, setWindowMinutes] = useState(60);
    const [overview, setOverview] = useState(null);
    const [points, setPoints] = useState([]);
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const [summary, timeseries, recentLogs] = await Promise.all([
                getOverview(windowMinutes),
                getTimeseries(windowMinutes),
                getRecentLogs(25)
            ]);

            setOverview(summary);
            setPoints(timeseries);
            setLogs(recentLogs);
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }, [windowMinutes]);

    useEffect(() => {
        load();

        const timer = setInterval(load, REFRESH_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [load]);

    const queue = overview && overview.health.queue;

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <h2>Inference metrics</h2>
                    <p>Read from the inference logs stored by the ingestion pipeline, refreshed every 5 seconds</p>
                </div>
                <select value={windowMinutes} onChange={event => setWindowMinutes(Number(event.target.value))}>
                    {WINDOW_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            {error && <div className="alert">{error}</div>}

            <div className="stat-grid">
                <StatCard
                    label="Requests"
                    value={formatNumber(overview?.requests)}
                    hint={`${overview?.requestsPerMinute ?? 0} per minute`}
                />
                <StatCard
                    label="Error rate"
                    value={formatPercent(overview?.errorRate)}
                    hint={`${formatNumber(overview?.errorCount)} errors, ${formatNumber(overview?.cancelledCount)} cancelled`}
                />
                <StatCard
                    label="Avg latency"
                    value={formatDuration(overview?.avgLatencyMs)}
                    hint={`p95 ${formatDuration(overview?.p95LatencyMs)}`}
                    hintTitle="p95 is the 95th percentile: 95 out of 100 requests finished faster than this. It catches slow outliers that an average hides."
                />
                <StatCard
                    label="Time to first token"
                    value={formatDuration(overview?.avgFirstTokenMs)}
                    hint="average across streamed replies"
                />
                <StatCard
                    label="Tokens"
                    value={formatNumber(overview?.totalTokens)}
                    hint={`${formatNumber(overview?.promptTokens)} in, ${formatNumber(overview?.completionTokens)} out`}
                />
            </div>

            <p className="pipeline-status">
                {queue
                    ? `Ingestion queue: ${queue.waiting} waiting, ${queue.active} processing, ${queue.failed} failed. Rejected payloads: ${overview?.health.failedLogs ?? 0}.`
                    : 'Ingestion queue unavailable — Redis is not reachable.'}
            </p>

            <MetricsCharts points={points} />

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">By provider and model</div>
                <div className="card-subtitle">Last {overview?.windowMinutes ?? windowMinutes} minutes</div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Model</th>
                                <th style={{ textAlign: 'right' }}>Requests</th>
                                <th style={{ textAlign: 'right' }}>Errors</th>
                                <th style={{ textAlign: 'right' }}>Avg latency</th>
                                <th style={{ textAlign: 'right' }}>Tokens</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(overview?.breakdown ?? []).map(row => (
                                <tr key={`${row.provider}-${row.model}`}>
                                    <td>{row.provider}</td>
                                    <td>{row.model}</td>
                                    <td className="number">{formatNumber(row.requests)}</td>
                                    <td className="number">{formatNumber(row.errors)}</td>
                                    <td className="number">{formatDuration(row.avgLatencyMs)}</td>
                                    <td className="number">{formatNumber(row.totalTokens)}</td>
                                </tr>
                            ))}

                            {!overview?.breakdown?.length && (
                                <tr><td colSpan={6} style={{ color: '#86867f' }}>No requests in this window.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <LogsTable logs={logs} />
        </div>
    );
}
