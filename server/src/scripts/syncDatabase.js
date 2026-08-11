const mysql = require('mysql2/promise');
const config = require('../config');
const { sequelize } = require('../models');
const logger = require('../utils/logger');

async function createDatabaseIfMissing() {
    const connection = await mysql.createConnection({
        host     : config.db.host,
        port     : config.db.port,
        user     : config.db.user,
        password : config.db.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4`);
    await connection.end();
}

async function run() {
    await createDatabaseIfMissing();
    await sequelize.sync({ alter: true });

    logger.info(`tables synced for ${config.db.name}`);

    await sequelize.close();
}

run().catch(error => {
    logger.error('database sync failed', error);
    process.exit(1);
});
