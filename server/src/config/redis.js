const config = require('./index');

const redisConnection = {
    host                 : config.redis.host,
    port                 : config.redis.port,
    maxRetriesPerRequest : null
};

const queueConnection = {
    host                 : config.redis.host,
    port                 : config.redis.port,
    maxRetriesPerRequest : 2,
    enableOfflineQueue   : false
};

module.exports = { redisConnection, queueConnection };
