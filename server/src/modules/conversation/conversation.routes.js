const express = require('express');
const conversationController = require('./conversation.controller');
const conversationValidation = require('./conversation.validation');
const chatController = require('../chat/chat.controller');
const chatValidation = require('../chat/chat.validation');
const validate = require('../../middlewares/validate');

const router = express.Router();

router.post('/', validate(conversationValidation.createConversation), conversationController.create);
router.get('/', validate(conversationValidation.listConversations, 'query'), conversationController.list);
router.get('/:uuid', conversationController.detail);
router.post('/:uuid/cancel', conversationController.cancel);
router.post('/:uuid/messages', validate(chatValidation.sendMessage), chatController.sendMessage);

module.exports = router;
