const express = require('express');
const config = require('../config');
const { listProviders } = require('../providers');
const { success } = require('../utils/apiResponse');
const conversationRoutes = require('../modules/conversation/conversation.routes');
const logsRoutes = require('../modules/logs/logs.routes');
const metricsRoutes = require('../modules/metrics/metrics.routes');

const router = express.Router();

router.get('/providers', (req, res) => success(res, {
    providers : listProviders(),
    defaults  : {
        provider : config.chat.defaultProvider,
        model    : config.chat.defaultModel
    }
}));

router.use('/conversations', conversationRoutes);
router.use('/logs', logsRoutes);
router.use('/metrics', metricsRoutes);

module.exports = router;
