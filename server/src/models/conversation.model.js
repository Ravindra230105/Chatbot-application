const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { CONVERSATION_STATUS } = require('../constants');

const Conversation = sequelize.define('Conversation', {
    id : {
        type          : DataTypes.BIGINT.UNSIGNED,
        primaryKey    : true,
        autoIncrement : true
    },
    uuid : {
        type      : DataTypes.CHAR(36),
        allowNull : false,
        unique    : true
    },
    sessionId : {
        type      : DataTypes.CHAR(36),
        allowNull : false
    },
    title : {
        type         : DataTypes.STRING(255),
        allowNull    : false,
        defaultValue : 'New conversation'
    },
    status : {
        type         : DataTypes.ENUM(Object.values(CONVERSATION_STATUS)),
        allowNull    : false,
        defaultValue : CONVERSATION_STATUS.ACTIVE
    },
    provider : {
        type      : DataTypes.STRING(32),
        allowNull : false
    },
    model : {
        type      : DataTypes.STRING(96),
        allowNull : false
    },
    messageCount : {
        type         : DataTypes.INTEGER.UNSIGNED,
        allowNull    : false,
        defaultValue : 0
    },
    totalTokens : {
        type         : DataTypes.INTEGER.UNSIGNED,
        allowNull    : false,
        defaultValue : 0
    },
    lastMessageAt : {
        type      : DataTypes.DATE,
        allowNull : true
    }
}, {
    tableName : 'conversations',
    indexes   : [
        { fields: ['session_id', 'status'] },
        { fields: ['last_message_at'] }
    ]
});

module.exports = Conversation;
