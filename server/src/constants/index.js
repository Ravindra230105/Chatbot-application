const CONVERSATION_STATUS = {
    ACTIVE    : 'active',
    CANCELLED : 'cancelled',
    ARCHIVED  : 'archived'
};

const MESSAGE_ROLE = {
    SYSTEM    : 'system',
    USER      : 'user',
    ASSISTANT : 'assistant'
};

const MESSAGE_STATUS = {
    STREAMING : 'streaming',
    COMPLETE  : 'complete',
    CANCELLED : 'cancelled',
    FAILED    : 'failed'
};

const INFERENCE_STATUS = {
    SUCCESS   : 'success',
    ERROR     : 'error',
    CANCELLED : 'cancelled'
};

const PROVIDER = {
    OPENAI    : 'openai',
    GROQ      : 'groq',
    ANTHROPIC : 'anthropic',
    GEMINI    : 'gemini'
};

const SSE_EVENT = {
    META  : 'meta',
    DELTA : 'delta',
    DONE  : 'done',
    ERROR : 'error'
};

const QUEUE = {
    INFERENCE_LOGS : 'inference-logs'
};

const TOKEN_SOURCE = {
    PROVIDER  : 'provider',
    ESTIMATED : 'estimated'
};

const PREVIEW_LENGTH = 500;

module.exports = {
    CONVERSATION_STATUS,
    MESSAGE_ROLE,
    MESSAGE_STATUS,
    INFERENCE_STATUS,
    PROVIDER,
    SSE_EVENT,
    QUEUE,
    TOKEN_SOURCE,
    PREVIEW_LENGTH
};
