const config = require('../config');
const { ApiError } = require('../utils/apiResponse');
const { parseSseStream } = require('./sseParser');

function createOpenAiCompatibleProvider({ name, label, baseUrl, getApiKey, getModels }) {
    return {
        name,
        label,
        isConfigured : () => Boolean(getApiKey()),

        get models() {
            return getModels();
        },

        async *streamChat({ model, systemPrompt, messages, signal }) {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method  : 'POST',
                headers : {
                    'Content-Type'  : 'application/json',
                    'Authorization' : `Bearer ${getApiKey()}`
                },
                body : JSON.stringify({
                    model,
                    stream         : true,
                    stream_options : { include_usage: true },
                    max_tokens     : config.chat.maxOutputTokens,
                    messages       : [{ role: 'system', content: systemPrompt }, ...messages]
                }),
                signal
            });

            if (!response.ok) {
                const body = await response.text();

                throw new ApiError(`${name} request failed (${response.status}): ${body.slice(0, 200)}`, 502, response.status);
            }

            for await (const event of parseSseStream(response)) {
                const choice = event.choices && event.choices[0];
                const text = choice && choice.delta && choice.delta.content;

                if (text) {
                    yield { text };
                }

                if (event.usage) {
                    yield {
                        usage : {
                            promptTokens     : event.usage.prompt_tokens,
                            completionTokens : event.usage.completion_tokens
                        }
                    };
                }
            }
        }
    };
}

module.exports = { createOpenAiCompatibleProvider };
