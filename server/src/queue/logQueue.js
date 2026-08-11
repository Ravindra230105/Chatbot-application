const { Queue } = require('bullmq');
const { QUEUE } = require('../constants');
const { queueConnection } = require('../config/redis');

const logQueue = new Queue(QUEUE.INFERENCE_LOGS, {
    connection        : queueConnection,
    defaultJobOptions : {
        attempts         : 3,
        backoff          : { type: 'exponential', delay: 1000 },
        removeOnComplete : 500,
        removeOnFail     : 200
    }
});

async function addLogJob(payload) {
    await logQueue.add('store-inference-log', payload, { jobId: payload.requestId });
}

async function getQueueCounts() {
    return logQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
}

module.exports = { logQueue, addLogJob, getQueueCounts };
