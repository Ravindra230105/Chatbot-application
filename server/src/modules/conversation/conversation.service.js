const { v4: uuidv4 } = require('uuid');
const { Conversation, Message } = require('../../models');
const { resolveProvider } = require('../../providers');
const { CONVERSATION_STATUS, MESSAGE_STATUS } = require('../../constants');
const { ApiError } = require('../../utils/apiResponse');
const { buildTitle } = require('../../utils/helpers');

async function createConversation({ sessionId, provider, model }) {
    const resolved = resolveProvider(provider, model);

    return Conversation.create({
        uuid      : uuidv4(),
        sessionId : sessionId || uuidv4(),
        provider  : resolved.provider.name,
        model     : resolved.model
    });
}

async function listConversations({ sessionId, status, limit }) {
    const where = {};

    if (sessionId) {
        where.sessionId = sessionId;
    }

    if (status) {
        where.status = status;
    }

    return Conversation.findAll({
        where,
        order : [['lastMessageAt', 'DESC'], ['id', 'DESC']],
        limit : Math.min(Number(limit) || 50, 100)
    });
}

async function getConversation(uuid) {
    const conversation = await Conversation.findOne({ where: { uuid } });

    if (!conversation) {
        throw new ApiError(`conversation ${uuid} not found`, 404);
    }

    return conversation;
}

async function getConversationWithMessages(uuid) {
    const conversation = await getConversation(uuid);
    const messages = await Message.findAll({
        where : { conversationId: conversation.id },
        order : [['id', 'ASC']]
    });

    return { conversation, messages };
}

async function getRecentMessages(conversationId, limit) {
    const messages = await Message.findAll({
        where : { conversationId, status: [MESSAGE_STATUS.COMPLETE, MESSAGE_STATUS.CANCELLED] },
        order : [['id', 'DESC']],
        limit
    });

    return messages.reverse().filter(message => message.content);
}

async function addMessage({ conversation, role, content, status, requestId }) {
    const message = await Message.create({
        uuid           : uuidv4(),
        conversationId : conversation.id,
        role,
        content,
        status         : status || MESSAGE_STATUS.COMPLETE,
        requestId      : requestId || null
    });

    const updates = {
        messageCount  : conversation.messageCount + 1,
        lastMessageAt : new Date()
    };

    if (conversation.messageCount === 0) {
        updates.title = buildTitle(content);
    }

    await conversation.update(updates);

    return message;
}

async function updateMessage(message, { content, status }) {
    return message.update({ content, status });
}

async function updateStatus(uuid, status) {
    const conversation = await getConversation(uuid);

    await conversation.update({ status });

    return conversation;
}

module.exports = {
    createConversation,
    listConversations,
    getConversation,
    getConversationWithMessages,
    getRecentMessages,
    addMessage,
    updateMessage,
    updateStatus
};
