const config = require('../config');
const { PROVIDER } = require('../constants');
const { createOpenAiCompatibleProvider } = require('./openAiCompatible');

module.exports = createOpenAiCompatibleProvider({
    name       : PROVIDER.GROQ,
    label      : 'Groq',
    baseUrl    : config.providerBaseUrls.groq,
    getApiKey  : () => config.providerKeys.groq,
    getModels  : () => config.providerModels.groq
});
