const { connectDatabase } = require('./src/config/database');
const { startLogWorker } = require('./src/queue/logProcessor');
const logger = require('./src/utils/logger');

require('./src/models');

async function start() {
    await connectDatabase();

    const worker = startLogWorker();

    const shutdown = async signal => {
        logger.info(`received ${signal}, closing worker`);

        await worker.close();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
    logger.error('failed to start worker', error);
    process.exit(1);
});
