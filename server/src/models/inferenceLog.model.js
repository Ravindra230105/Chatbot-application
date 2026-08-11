const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { INFERENCE_STATUS } = require('../constants');

const InferenceLog = sequelize.define('InferenceLog', {
    id : {
        type          : DataTypes.BIGINT.UNSIGNED,
        primaryKey    : true,
        autoIncrement : true
    },
    requestId : {
        type      : DataTypes.CHAR(36),
        allowNull : false,
        unique    : true
    },
    conversationUuid : {
        type      : DataTypes.CHAR(36),
        allowNull : true
    },
    messageUuid : {
        type      : DataTypes.CHAR(36),
        allowNull : true
    },
    sessionId : {
        type      : DataTypes.CHAR(36),
        allowNull : true
    },
    provider : {
        type      : DataTypes.STRING(32),
        allowNull : false
    },
    model : {
        type      : DataTypes.STRING(96),
        allowNull : false
    },
    status : {
        type      : DataTypes.ENUM(Object.values(INFERENCE_STATUS)),
        allowNull : false
    },
    isStream : {
        type         : DataTypes.BOOLEAN,
        allowNull    : false,
        defaultValue : false
    },
    latencyMs : {
        type      : DataTypes.INTEGER.UNSIGNED,
        allowNull : false
    },
    timeToFirstTokenMs : {
        type      : DataTypes.INTEGER.UNSIGNED,
        allowNull : true
    },
    promptTokens : {
        type         : DataTypes.INTEGER.UNSIGNED,
        allowNull    : false,
        defaultValue : 0
    },
    completionTokens : {
        type         : DataTypes.INTEGER.UNSIGNED,
        allowNull    : false,
        defaultValue : 0
    },
    totalTokens : {
        type         : DataTypes.INTEGER.UNSIGNED,
        allowNull    : false,
        defaultValue : 0
    },
    costUsd : {
        type         : DataTypes.DECIMAL(12, 6),
        allowNull    : false,
        defaultValue : 0
    },
    errorType : {
        type      : DataTypes.STRING(96),
        allowNull : true
    },
    errorMessage : {
        type      : DataTypes.TEXT,
        allowNull : true
    },
    inputPreview : {
        type      : DataTypes.STRING(512),
        allowNull : true
    },
    outputPreview : {
        type      : DataTypes.STRING(512),
        allowNull : true
    },
    piiRedacted : {
        type         : DataTypes.BOOLEAN,
        allowNull    : false,
        defaultValue : false
    },
    metadata : {
        type      : DataTypes.JSON,
        allowNull : true
    },
    startedAt : {
        type      : DataTypes.DATE,
        allowNull : false
    },
    finishedAt : {
        type      : DataTypes.DATE,
        allowNull : false
    }
}, {
    tableName : 'inference_logs',
    indexes   : [
        { fields: ['started_at'] },
        { fields: ['provider', 'model'] },
        { fields: ['status'] },
        { fields: ['conversation_uuid'] }
    ]
});

module.exports = InferenceLog;
