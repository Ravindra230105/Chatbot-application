const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { sequelize, InferenceLog, FailedLog } = require('../../models');
const { INFERENCE_STATUS } = require('../../constants');
const { getQueueCounts } = require('../../queue/logQueue');
const { percentile, average } = require('../../utils/helpers');
const logger = require('../../utils/logger');

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
                ROUND(AVG(time_to_first_token_ms)) AS avgFirstTokenMs
         FROM inference_logs
         WHERE started_at >= :since
         GROUP BY minute
         ORDER BY minute ASC`,
        {
            replacements : { since: windowStartUtcString(minutes) },
            type         : QueryTypes.SELECT
        }
    );

    const byMinute = new Map(rows.map(row => [row.minute, row]));
    const firstMinute = windowStart(minutes);

    firstMinute.setSeconds(0, 0);

    const points = [];

    for (let step = 0; step <= minutes; step += 1) {
        const minute = new Date(firstMinute.getTime() + step * 60000).toISOString().replace(/\.\d+Z$/, '.000Z');
        const row = byMinute.get(minute);

        points.push({
            minute,
            requests        : row ? Number(row.requests) : 0,
            errors          : row ? Number(row.errors || 0) : 0,
            avgLatencyMs    : row ? Number(row.avgLatencyMs) : null,
            avgFirstTokenMs : row && row.avgFirstTokenMs !== null ? Number(row.avgFirstTokenMs) : null
        });
    }

    return points;
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
        const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error('queue read timed out')), 3000));
        const queueCounts = await Promise.race([getQueueCounts(), timeout]);

        return { queue: queueCounts, failedLogs };
    } catch (error) {
        logger.warn(`could not read queue counts: ${error.message}`);

        return { queue: null, failedLogs };
    }
}

module.exports = { getSummary, getTimeseries, getProviderBreakdown, getRecentLogs, getPipelineHealth };
