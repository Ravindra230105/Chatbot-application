const Joi = require('joi');
const { CONVERSATION_STATUS } = require('../../constants');

const createConversation = Joi.object({
    provider : Joi.string().max(32),
    model    : Joi.string().max(96)
});

const listConversations = Joi.object({
    status : Joi.string().valid(...Object.values(CONVERSATION_STATUS)),
    limit  : Joi.number().integer().min(1).max(100),
    mine   : Joi.boolean()
});

module.exports = { createConversation, listConversations };
