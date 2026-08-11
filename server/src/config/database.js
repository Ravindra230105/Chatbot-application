const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host    : config.db.host,
    port    : config.db.port,
    dialect : 'mysql',
    logging : false,
    define  : {
        underscored : true,
        timestamps  : true
    },
    pool : {
        max  : 10,
        min  : 0,
        idle : 10000
    }
});

async function connectDatabase() {
    await sequelize.authenticate();
    logger.info(`database connected: ${config.db.name}`);
}

module.exports = { sequelize, connectDatabase };
