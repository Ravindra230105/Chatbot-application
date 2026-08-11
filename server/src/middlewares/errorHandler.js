const logger = require('../utils/logger');
const { failure } = require('../utils/apiResponse');

function notFound(req, res) {
    return failure(res, `route ${req.method} ${req.originalUrl} not found`, 404);
}

function errorHandler(error, req, res, next) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl}`, error);
    }

    if (res.headersSent) {
        return res.end();
    }

    return failure(res, error.message || 'internal server error', statusCode);
}

module.exports = { notFound, errorHandler };
