const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { MESSAGE_ROLE, MESSAGE_STATUS } = require('../constants');

const Message = sequelize.define('Message', {
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
    conversationId : {
        type      : DataTypes.BIGINT.UNSIGNED,
        allowNull : false
    },
    role : {
        type      : DataTypes.ENUM(Object.values(MESSAGE_ROLE)),
        allowNull : false
    },
    content : {
        type      : DataTypes.TEXT('medium'),
        allowNull : false
    },
    status : {
        type         : DataTypes.ENUM(Object.values(MESSAGE_STATUS)),
        allowNull    : false,
        defaultValue : MESSAGE_STATUS.COMPLETE
    },
    tokenCount : {
        type      : DataTypes.INTEGER.UNSIGNED,
        allowNull : true
    },
    requestId : {
        type      : DataTypes.CHAR(36),
        allowNull : true
    }
}, {
    tableName : 'messages',
    indexes   : [
        { fields: ['conversation_id', 'id'] },
        { fields: ['request_id'] }
    ]
});

module.exports = Message;
