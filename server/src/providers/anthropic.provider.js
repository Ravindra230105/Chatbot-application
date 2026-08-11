const config = require('../config');
const { PROVIDER } = require('../constants');
const { ApiError } = require('../utils/apiResponse');
const { parseSseStream } = require('./sseParser');

module.exports = {
    name         : PROVIDER.ANTHROPIC,
    label        : 'Anthropic',
    models       : config.providerModels.anthropic,
    isConfigured : () => Boolean(config.providerKeys.anthropic),

    async *streamChat({ model, systemPrompt, messages, signal }) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method  : 'POST',
            headers : {
                'Content-Type'      : 'application/json',
                'x-api-key'         : config.providerKeys.anthropic,
                'anthropic-version' : '2023-06-01'
            },
            body : JSON.stringify({
                model,
                stream     : true,
                max_tokens : config.chat.maxOutputTokens,
                system     : systemPrompt,
                messages
            }),
            signal
        });

        if (!response.ok) {
            const body = await response.text();

            throw new ApiError(`anthropic request failed (${response.status}): ${body.slice(0, 200)}`, 502, response.status);
        }

        let promptTokens = 0;

        for await (const event of parseSseStream(response)) {
            if (event.type === 'message_start') {
                promptTokens = event.message.usage.input_tokens;
            }

            if (event.type === 'content_block_delta' && event.delta.text) {
                yield { text: event.delta.text };
            }

            if (event.type === 'message_delta' && event.usage) {
                yield {
                    usage : {
                        promptTokens,
                        completionTokens : event.usage.output_tokens
                    }
                };
            }
        }
    }
};
