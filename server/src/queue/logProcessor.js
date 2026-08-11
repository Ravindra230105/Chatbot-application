const { Worker } = require('bullmq');
const { QUEUE } = require('../constants');
const { redisConnection } = require('../config/redis');
const logsService = require('../modules/logs/logs.service');
const logger = require('../utils/logger');

function startLogWorker() {
    const worker = new Worker(
        QUEUE.INFERENCE_LOGS,
        async job => logsService.storeInferenceLog(job.data),
        { connection: redisConnection, concurrency: 5 }
    );

    worker.on('completed', job => {
        logger.info(`stored inference log ${job.data.requestId}`);
    });

    worker.on('failed', async (job, error) => {
        logger.error(`job ${job && job.id} failed`, error);

        if (job && job.attemptsMade >= job.opts.attempts) {
            await logsService.saveFailedLog('worker', job.data, error.message);
        }
    });

    logger.info(`worker listening on queue ${QUEUE.INFERENCE_LOGS}`);

    return worker;
}

module.exports = { startLogWorker };
