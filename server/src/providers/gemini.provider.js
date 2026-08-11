const config = require('../config');
const { PROVIDER, MESSAGE_ROLE } = require('../constants');
const { ApiError } = require('../utils/apiResponse');
const { parseSseStream } = require('./sseParser');

module.exports = {
    name         : PROVIDER.GEMINI,
    label        : 'Google Gemini',
    models       : config.providerModels.gemini,
    isConfigured : () => Boolean(config.providerKeys.gemini),

    async *streamChat({ model, systemPrompt, messages, signal }) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

        const response = await fetch(url, {
            method  : 'POST',
            headers : {
                'Content-Type'   : 'application/json',
                'x-goog-api-key' : config.providerKeys.gemini
            },
            body : JSON.stringify({
                systemInstruction : { parts: [{ text: systemPrompt }] },
                generationConfig  : {
                    maxOutputTokens : config.chat.geminiMaxOutputTokens,
                    thinkingConfig  : { thinkingLevel: config.chat.geminiThinkingLevel }
                },
                contents          : messages.map(message => ({
                    role  : message.role === MESSAGE_ROLE.ASSISTANT ? 'model' : 'user',
                    parts : [{ text: message.content }]
                }))
            }),
            signal
        });

        if (!response.ok) {
            const body = await response.text();

            throw new ApiError(`gemini request failed (${response.status}): ${body.slice(0, 200)}`, 502, response.status);
        }

        for await (const event of parseSseStream(response)) {
            const candidate = event.candidates && event.candidates[0];
            const parts = candidate && candidate.content && candidate.content.parts;
            const text = parts ? parts.map(part => part.text || '').join('') : '';

            if (text) {
                yield { text };
            }

            if (event.usageMetadata) {
                const answerTokens = event.usageMetadata.candidatesTokenCount || 0;
                const thoughtTokens = event.usageMetadata.thoughtsTokenCount || 0;

                yield {
                    usage : {
                        promptTokens     : event.usageMetadata.promptTokenCount,
                        completionTokens : answerTokens + thoughtTokens
                    }
                };
            }
        }
    }
};
