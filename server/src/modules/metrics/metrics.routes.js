const express = require('express');
const metricsController = require('./metrics.controller');

const router = express.Router();

router.get('/overview', metricsController.overview);
router.get('/timeseries', metricsController.timeseries);
router.get('/logs', metricsController.recentLogs);

module.exports = router;
