export function formatNumber(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    return new Intl.NumberFormat('en-US').format(value);
}

export function formatDuration(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
}

export function formatPercent(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    return `${(value * 100).toFixed(1)}%`;
}

export function formatMinute(minute) {
    if (!minute) {
        return '';
    }

    return new Date(minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(value) {
    if (!value) {
        return 'no messages yet';
    }

    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);

    if (seconds < 60) {
        return 'just now';
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    return `${Math.round(hours / 24)}d ago`;
}

export function formatDateTime(value) {
    return new Date(value).toLocaleString([], {
        month  : 'short',
        day    : 'numeric',
        hour   : '2-digit',
        minute : '2-digit',
        second : '2-digit'
    });
}
