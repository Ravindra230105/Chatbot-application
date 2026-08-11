const conversationService = require('./conversation.service');
const { CONVERSATION_STATUS } = require('../../constants');
const { success } = require('../../utils/apiResponse');

function formatConversation(conversation) {
    return {
        uuid          : conversation.uuid,
        title         : conversation.title,
        status        : conversation.status,
        provider      : conversation.provider,
        model         : conversation.model,
        messageCount  : conversation.messageCount,
        totalTokens   : conversation.totalTokens,
        lastMessageAt : conversation.lastMessageAt,
        createdAt     : conversation.createdAt
    };
}

function formatMessage(message) {
    return {
        uuid       : message.uuid,
        role       : message.role,
        content    : message.content,
        status     : message.status,
        tokenCount : message.tokenCount,
        requestId  : message.requestId,
        createdAt  : message.createdAt
    };
}

async function create(req, res, next) {
    try {
        const conversation = await conversationService.createConversation({
            sessionId : req.sessionId,
            provider  : req.body.provider,
            model     : req.body.model
        });

        return success(res, formatConversation(conversation), 201);
    } catch (error) {
        return next(error);
    }
}

async function list(req, res, next) {
    try {
        const conversations = await conversationService.listConversations({
            sessionId : req.query.mine ? req.sessionId : null,
            status    : req.query.status,
            limit     : req.query.limit
        });

        return success(res, conversations.map(formatConversation));
    } catch (error) {
        return next(error);
    }
}

async function detail(req, res, next) {
    try {
        const { conversation, messages } = await conversationService.getConversationWithMessages(req.params.uuid);

        return success(res, {
            conversation : formatConversation(conversation),
            messages     : messages.map(formatMessage)
        });
    } catch (error) {
        return next(error);
    }
}

async function cancel(req, res, next) {
    try {
        const conversation = await conversationService.updateStatus(req.params.uuid, CONVERSATION_STATUS.CANCELLED);

        return success(res, formatConversation(conversation));
    } catch (error) {
        return next(error);
    }
}

module.exports = { create, list, detail, cancel, formatConversation, formatMessage };
