const { v4: uuidv4 } = require('uuid');

function session(req, res, next) {
    req.sessionId = req.get('x-session-id') || uuidv4();

    return next();
}

module.exports = session;
