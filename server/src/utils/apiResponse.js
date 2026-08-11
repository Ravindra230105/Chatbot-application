function success(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function failure(res, message, statusCode = 400) {
    return res.status(statusCode).json({ success: false, message });
}

class ApiError extends Error {
    constructor(message, statusCode = 400, providerStatus = null) {
        super(message);
        this.statusCode = statusCode;
        this.providerStatus = providerStatus;
    }
}

module.exports = { success, failure, ApiError };
