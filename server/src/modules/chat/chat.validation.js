const Joi = require('joi');

const sendMessage = Joi.object({
    content  : Joi.string().trim().min(1).max(4000).required(),
    provider : Joi.string().max(32),
    model    : Joi.string().max(96)
});

module.exports = { sendMessage };
