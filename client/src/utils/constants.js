export const CHART_COLORS = {
    primary : '#2a78d6',
    accent  : '#eb6834',
    danger  : '#d03b3b',
    grid    : '#e5e5e0',
    axis    : '#8a8a84'
};

export const WINDOW_OPTIONS = [
    { label: 'Last 15 minutes', value: 15 },
    { label: 'Last hour', value: 60 },
    { label: 'Last 6 hours', value: 360 },
    { label: 'Last 24 hours', value: 1440 }
];

export const CONVERSATION_FILTERS = [
    { label: 'All conversations', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Cancelled', value: 'cancelled' }
];

export const REFRESH_INTERVAL_MS = 5000;
