const { sequelize } = require('../config/database');
const Conversation = require('./conversation.model');
const Message = require('./message.model');
const InferenceLog = require('./inferenceLog.model');
const FailedLog = require('./failedLog.model');

Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages', constraints: false });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation', constraints: false });

module.exports = { sequelize, Conversation, Message, InferenceLog, FailedLog };
