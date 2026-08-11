import React from 'react';
import { formatDateTime, formatDuration, formatNumber } from '../utils/format';

export default function LogsTable({ logs }) {
    return (
        <div className="card">
            <div className="card-title spaced">Recent inference logs</div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Provider</th>
                            <th>Model</th>
                            <th style={{ textAlign: 'right' }}>Latency</th>
                            <th style={{ textAlign: 'right' }}>First token</th>
                            <th style={{ textAlign: 'right' }}>Tokens</th>
                            <th>Input</th>
                            <th>Output</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.requestId}>
                                <td>{formatDateTime(log.startedAt)}</td>
                                <td>
                                    <span className={`badge ${log.status}`}>{log.status}</span>
                                    {log.piiRedacted && <span className="badge" style={{ marginLeft: 4 }}>pii</span>}
                                </td>
                                <td>{log.provider}</td>
                                <td>{log.model}</td>
                                <td className="number">{formatDuration(log.latencyMs)}</td>
                                <td className="number">{formatDuration(log.timeToFirstTokenMs)}</td>
                                <td className="number">{formatNumber(log.totalTokens)}</td>
                                <td className="preview">{log.inputPreview}</td>
                                <td className="preview">{log.status === 'error' ? log.errorMessage : log.outputPreview}</td>
                            </tr>
                        ))}

                        {!logs.length && (
                            <tr><td colSpan={9} style={{ color: '#86867f' }}>No logs yet. Send a chat message first.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
