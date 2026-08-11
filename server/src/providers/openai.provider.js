const config = require('../config');
const { PROVIDER } = require('../constants');
const { createOpenAiCompatibleProvider } = require('./openAiCompatible');

module.exports = createOpenAiCompatibleProvider({
    name       : PROVIDER.OPENAI,
    label      : 'OpenAI',
    baseUrl    : config.providerBaseUrls.openai,
    getApiKey  : () => config.providerKeys.openai,
    getModels  : () => config.providerModels.openai
});
