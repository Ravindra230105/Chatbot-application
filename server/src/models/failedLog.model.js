const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FailedLog = sequelize.define('FailedLog', {
    id : {
        type          : DataTypes.BIGINT.UNSIGNED,
        primaryKey    : true,
        autoIncrement : true
    },
    source : {
        type      : DataTypes.STRING(32),
        allowNull : false
    },
    requestId : {
        type      : DataTypes.CHAR(36),
        allowNull : true
    },
    reason : {
        type      : DataTypes.TEXT,
        allowNull : false
    },
    payload : {
        type      : DataTypes.JSON,
        allowNull : false
    }
}, {
    tableName : 'failed_logs',
    indexes   : [{ fields: ['created_at'] }]
});

module.exports = FailedLog;
