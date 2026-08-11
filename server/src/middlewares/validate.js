const { failure } = require('../utils/apiResponse');

function validate(schema, source = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });

        if (error) {
            return failure(res, error.details.map(detail => detail.message).join(', '), 422);
        }

        req[source] = value;

        return next();
    };
}

module.exports = validate;
