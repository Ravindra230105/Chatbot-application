const { PREVIEW_LENGTH, MESSAGE_ROLE } = require('../constants');

function estimateTokens(text) {
    if (!text) {
        return 0;
    }

    return Math.max(1, Math.ceil(text.length / 4));
}

function buildPreview(text, limit = PREVIEW_LENGTH) {
    const cleaned = (text || '').replace(/\s+/g, ' ').trim();

    return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}...` : cleaned;
}

function buildTitle(text) {
    const preview = buildPreview(text, 60);

    return preview || 'New conversation';
}

function percentile(values, fraction) {
    if (!values.length) {
        return null;
    }

    const sorted = [...values].sort((first, second) => first - second);
    const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);

    return sorted[Math.max(0, index)];
}

function average(values) {
    if (!values.length) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    return Math.round(total / values.length);
}

function withTimeout(promise, timeoutMs, label) {
    let timer = null;

    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeHistory(messages) {
    const normalized = [];

    messages.forEach(message => {
        const previous = normalized[normalized.length - 1];

        if (previous && previous.role === message.role) {
            previous.content = `${previous.content}\n\n${message.content}`;

            return;
        }

        if (!normalized.length && message.role !== MESSAGE_ROLE.USER) {
            return;
        }

        normalized.push({ role: message.role, content: message.content });
    });

    return normalized;
}

module.exports = { estimateTokens, buildPreview, buildTitle, percentile, average, normalizeHistory, withTimeout };
