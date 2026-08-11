const app = require('./src/app');
const config = require('./src/config');
const { connectDatabase } = require('./src/config/database');
const logger = require('./src/utils/logger');

require('./src/models');

async function start() {
    await connectDatabase();

    const server = app.listen(config.port, () => {
        logger.info(`server running on port ${config.port} (default provider: ${config.chat.defaultProvider})`);
    });

    const shutdown = signal => {
        logger.info(`received ${signal}, closing server`);

        server.close(() => process.exit(0));
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
    logger.error('failed to start server', error);
    process.exit(1);
});
