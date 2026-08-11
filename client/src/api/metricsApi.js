import axiosClient from './axiosClient';

export function getOverview(windowMinutes) {
    return axiosClient.get('/metrics/overview', { params: { window: windowMinutes } });
}

export function getTimeseries(windowMinutes) {
    return axiosClient.get('/metrics/timeseries', { params: { window: windowMinutes } });
}

export function getRecentLogs(limit) {
    return axiosClient.get('/metrics/logs', { params: { limit } });
}
