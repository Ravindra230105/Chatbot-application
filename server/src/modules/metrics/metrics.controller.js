const metricsService = require('./metrics.service');
const { success } = require('../../utils/apiResponse');

const DEFAULT_WINDOW_MINUTES = 60;

function resolveWindow(value) {
    return Math.min(Math.max(Number(value) || DEFAULT_WINDOW_MINUTES, 1), 1440);
}

async function overview(req, res, next) {
    try {
        const minutes = resolveWindow(req.query.window);

        const [summary, breakdown, health] = await Promise.all([
            metricsService.getSummary(minutes),
            metricsService.getProviderBreakdown(minutes),
            metricsService.getPipelineHealth()
        ]);

        return success(res, { ...summary, breakdown, health });
    } catch (error) {
        return next(error);
    }
}

async function timeseries(req, res, next) {
    try {
        const points = await metricsService.getTimeseries(resolveWindow(req.query.window));

        return success(res, points);
    } catch (error) {
        return next(error);
    }
}

async function recentLogs(req, res, next) {
    try {
        const logs = await metricsService.getRecentLogs(req.query.limit);

        return success(res, logs);
    } catch (error) {
        return next(error);
    }
}

module.exports = { overview, timeseries, recentLogs };
