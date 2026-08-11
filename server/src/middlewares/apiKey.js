const config = require('../config');
const { failure } = require('../utils/apiResponse');

function apiKey(req, res, next) {
    if (req.get('x-api-key') !== config.ingestion.apiKey) {
        return failure(res, 'invalid api key', 401);
    }

    return next();
}

module.exports = apiKey;
