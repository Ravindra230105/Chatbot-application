import React from 'react';

export default function StatCard({ label, value, hint, hintTitle }) {
    return (
        <div className="card">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {hint && (
                <div className={`stat-hint ${hintTitle ? 'explained' : ''}`} title={hintTitle}>
                    {hint}
                </div>
            )}
        </div>
    );
}
