const config = require('../config');
const { ApiError } = require('../utils/apiResponse');
const openaiProvider = require('./openai.provider');
const groqProvider = require('./groq.provider');
const anthropicProvider = require('./anthropic.provider');
const geminiProvider = require('./gemini.provider');

const providers = [openaiProvider, groqProvider, anthropicProvider, geminiProvider];

function listProviders() {
    return providers.map(provider => ({
        name       : provider.name,
        label      : provider.label,
        models     : provider.models,
        configured : provider.isConfigured()
    }));
}

function resolveProvider(providerName, modelName) {
    const provider = providers.find(item => item.name === (providerName || config.chat.defaultProvider));

    if (!provider) {
        throw new ApiError(`unknown provider: ${providerName}`, 400);
    }

    if (!provider.isConfigured()) {
        throw new ApiError(`provider ${provider.name} has no api key configured`, 400);
    }

    const model = modelName || provider.models[0];

    if (!provider.models.includes(model)) {
        throw new ApiError(`model ${model} is not available for ${provider.name}`, 400);
    }

    return { provider, model };
}

module.exports = { listProviders, resolveProvider };
