const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const session = require('./middlewares/session');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

if (config.env === 'development') {
    app.use(morgan('dev'));
}

app.use(session);

app.get('/health', (req, res) => res.json({ status: 'ok', env: config.env }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
