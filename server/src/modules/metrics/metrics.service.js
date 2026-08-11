const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize, InferenceLog, FailedLog } = require('../../models');
const { INFERENCE_STATUS } = require('../../constants');
const { getQueueCounts } = require('../../queue/logQueue');
const { percentile, average, withTimeout } = require('../../utils/helpers');
const logger = require('../../utils/logger');

const QUEUE_READ_TIMEOUT_MS = 3000;

function windowStart(minutes) {
    return new Date(Date.now() - minutes * 60000);
}

function windowStartUtcString(minutes) {
    return windowStart(minutes).toISOString().slice(0, 19).replace('T', ' ');
}

async function getSummary(minutes) {
    const since = windowStart(minutes);
    const where = { startedAt: { [Op.gte]: since } };

    const [totals, latencyRows] = await Promise.all([
        InferenceLog.findOne({
            attributes : [
                [fn('COUNT', col('id')), 'requests'],
                [fn('SUM', literal(`status = '${INFERENCE_STATUS.SUCCESS}'`)), 'successCount'],
                [fn('SUM', literal(`status = '${INFERENCE_STATUS.ERROR}'`)), 'errorCount'],
                [fn('SUM', literal(`status = '${INFERENCE_STATUS.CANCELLED}'`)), 'cancelledCount'],
                [fn('SUM', col('prompt_tokens')), 'promptTokens'],
                [fn('SUM', col('completion_tokens')), 'completionTokens']
            ],
            where,
            raw : true
        }),
        InferenceLog.findAll({
            attributes : ['latencyMs', 'timeToFirstTokenMs'],
            where,
            raw        : true
        })
    ]);

    const requests = Number(totals.requests || 0);
    const errorCount = Number(totals.errorCount || 0);
    const latencies = latencyRows.map(row => row.latencyMs);
    const firstTokenTimes = latencyRows.filter(row => row.timeToFirstTokenMs).map(row => row.timeToFirstTokenMs);
    const promptTokens = Number(totals.promptTokens || 0);
    const completionTokens = Number(totals.completionTokens || 0);

    return {
        windowMinutes     : minutes,
        requests,
        successCount      : Number(totals.successCount || 0),
        errorCount,
        cancelledCount    : Number(totals.cancelledCount || 0),
        errorRate         : requests ? Number((errorCount / requests).toFixed(4)) : 0,
        requestsPerMinute : Number((requests / minutes).toFixed(2)),
        avgLatencyMs      : average(latencies),
        p95LatencyMs      : percentile(latencies, 0.95),
        maxLatencyMs      : latencies.length ? Math.max(...latencies) : null,
        avgFirstTokenMs   : average(firstTokenTimes),
        promptTokens,
        completionTokens,
        totalTokens       : promptTokens + completionTokens
    };
}

async function getTimeseries(minutes) {
    const rows = await sequelize.query(
        `SELECT DATE_FORMAT(started_at, '%Y-%m-%dT%H:%i:00.000Z') AS minute,
                COUNT(*) AS requests,
                SUM(status = '${INFERENCE_STATUS.ERROR}') AS errors,
                ROUND(AVG(latency_ms)) AS avgLatencyMs,
                ROUND(AVG(time_to_first_token_ms)) AS avgFirstTokenMs,
                SUM(total_tokens) AS totalTokens
         FROM inference_logs
         WHERE started_at >= :since
         GROUP BY minute
         ORDER BY minute ASC`,
        {
            replacements : { since: windowStartUtcString(minutes) },
            type         : QueryTypes.SELECT
        }
    );

    return rows.map(row => ({
        minute          : row.minute,
        requests        : Number(row.requests),
        errors          : Number(row.errors || 0),
        avgLatencyMs    : Number(row.avgLatencyMs || 0),
        avgFirstTokenMs : Number(row.avgFirstTokenMs || 0),
        totalTokens     : Number(row.totalTokens || 0)
    }));
}

async function getProviderBreakdown(minutes) {
    const rows = await InferenceLog.findAll({
        attributes : [
            'provider',
            'model',
            [fn('COUNT', col('id')), 'requests'],
            [fn('SUM', literal(`status = '${INFERENCE_STATUS.ERROR}'`)), 'errors'],
            [fn('ROUND', fn('AVG', col('latency_ms'))), 'avgLatencyMs'],
            [fn('SUM', col('total_tokens')), 'totalTokens']
        ],
        where   : { startedAt: { [Op.gte]: windowStart(minutes) } },
        group   : ['provider', 'model'],
        order   : [[literal('requests'), 'DESC']],
        raw     : true
    });

    return rows.map(row => ({
        provider     : row.provider,
        model        : row.model,
        requests     : Number(row.requests),
        errors       : Number(row.errors || 0),
        avgLatencyMs : Number(row.avgLatencyMs || 0),
        totalTokens  : Number(row.totalTokens || 0)
    }));
}

async function getRecentLogs(limit) {
    const logs = await InferenceLog.findAll({
        order : [['id', 'DESC']],
        limit : Math.min(Number(limit) || 25, 100)
    });

    return logs.map(log => ({
        requestId          : log.requestId,
        conversationUuid   : log.conversationUuid,
        provider           : log.provider,
        model              : log.model,
        status             : log.status,
        latencyMs          : log.latencyMs,
        promptTokens       : log.promptTokens,
        completionTokens   : log.completionTokens,
        timeToFirstTokenMs : log.timeToFirstTokenMs,
        totalTokens        : log.totalTokens,
        piiRedacted        : log.piiRedacted,
        inputPreview       : log.inputPreview,
        outputPreview      : log.outputPreview,
        errorMessage       : log.errorMessage,
        startedAt          : log.startedAt
    }));
}

async function getPipelineHealth() {
    const failedLogs = await FailedLog.count();

    try {
        const queueCounts = await withTimeout(getQueueCounts(), QUEUE_READ_TIMEOUT_MS, 'queue counts');

        return { queue: queueCounts, failedLogs };
    } catch (error) {
        logger.warn(`could not read queue counts: ${error.message}`);

        return { queue: null, failedLogs };
    }
}

module.exports = { getSummary, getTimeseries, getProviderBreakdown, getRecentLogs, getPipelineHealth };
