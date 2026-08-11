require('dotenv').config();

function parseModelList(value, fallback) {
    if (!value) {
        return fallback;
    }

    return value.split(',').map(model => model.trim()).filter(Boolean);
}

module.exports = {
    env  : process.env.NODE_ENV || 'development',
    port : Number(process.env.PORT || 5000),

    db : {
        host     : process.env.DB_HOST || '127.0.0.1',
        port     : Number(process.env.DB_PORT || 3306),
        name     : process.env.DB_NAME || 'ollive_inference',
        user     : process.env.DB_USER || 'root',
        password : process.env.DB_PASSWORD || ''
    },

    redis : {
        host             : process.env.REDIS_HOST || '127.0.0.1',
        port             : Number(process.env.REDIS_PORT || 6379),
        commandTimeoutMs : Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 5000)
    },

    ingestion : {
        url       : process.env.INGESTION_URL || 'http://127.0.0.1:5000',
        apiKey    : process.env.INGESTION_API_KEY || 'local-dev-key',
        timeoutMs : Number(process.env.INGESTION_TIMEOUT_MS || 5000)
    },

    chat : {
        defaultProvider     : process.env.DEFAULT_PROVIDER || 'groq',
        defaultModel        : process.env.DEFAULT_MODEL || 'llama-3.3-70b-versatile',
        contextMessageLimit : Number(process.env.CONTEXT_MESSAGE_LIMIT || 10),
        maxOutputTokens       : Number(process.env.MAX_OUTPUT_TOKENS || 1024),
        geminiMaxOutputTokens : Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 3072),
        geminiThinkingLevel   : process.env.GEMINI_THINKING_LEVEL || 'low'
    },

    redactPii : process.env.REDACT_PII !== 'false',

    providerKeys : {
        openai    : process.env.OPENAI_API_KEY || '',
        groq      : process.env.GROQ_API_KEY || '',
        anthropic : process.env.ANTHROPIC_API_KEY || '',
        gemini    : process.env.GEMINI_API_KEY || ''
    },

    providerBaseUrls : {
        openai : process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        groq   : process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    },

    providerModels : {
        openai    : parseModelList(process.env.OPENAI_MODELS, ['gpt-4.1-mini', 'gpt-4o-mini']),
        groq      : parseModelList(process.env.GROQ_MODELS, ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b']),
        anthropic : parseModelList(process.env.ANTHROPIC_MODELS, ['claude-sonnet-4-5', 'claude-haiku-4-5']),
        gemini    : parseModelList(process.env.GEMINI_MODELS, ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash'])
    }
};
