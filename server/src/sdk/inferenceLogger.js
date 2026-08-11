const config = require('../config');
const logger = require('../utils/logger');
const { redactText } = require('./redact');
const { estimateCost } = require('./pricing');
const { buildPreview, estimateTokens } = require('../utils/helpers');
const { TOKEN_SOURCE } = require('../constants');

function buildPayload(context, timing, result) {
    const reportedPrompt = result.usage ? result.usage.promptTokens : null;
    const reportedCompletion = result.usage ? result.usage.completionTokens : null;

    const promptTokens = reportedPrompt || estimateTokens(context.inputText);
    const completionTokens = reportedCompletion || estimateTokens(result.outputText);
    const tokenSource = reportedPrompt && reportedCompletion ? TOKEN_SOURCE.PROVIDER : TOKEN_SOURCE.ESTIMATED;

    const inputPreview = config.redactPii ? redactText(buildPreview(context.inputText)) : { text: buildPreview(context.inputText), labels: [] };
    const outputPreview = config.redactPii ? redactText(buildPreview(result.outputText)) : { text: buildPreview(result.outputText), labels: [] };

    return {
        requestId          : context.requestId,
        conversationUuid   : context.conversationUuid,
        messageUuid        : context.messageUuid,
        sessionId          : context.sessionId,
        provider           : context.provider,
        model              : context.model,
        isStream           : true,
        status             : result.status,
        latencyMs          : timing.latencyMs,
        timeToFirstTokenMs : timing.timeToFirstTokenMs,
        promptTokens,
        completionTokens,
        costUsd            : estimateCost(context.model, promptTokens, completionTokens),
        errorType          : result.errorType || null,
        errorMessage       : result.errorMessage || null,
        inputPreview       : inputPreview.text,
        outputPreview      : outputPreview.text,
        piiRedacted        : Boolean(inputPreview.labels.length || outputPreview.labels.length),
        metadata           : {
            tokenSource,
            chunkCount     : result.chunkCount || 0,
            redactedLabels : [...new Set([...inputPreview.labels, ...outputPreview.labels])]
        },
        startedAt  : timing.startedAt,
        finishedAt : timing.finishedAt
    };
}

async function sendLog(payload) {
    try {
        const response = await fetch(`${config.ingestion.url}/api/logs`, {
            method  : 'POST',
            headers : {
                'Content-Type' : 'application/json',
                'x-api-key'    : config.ingestion.apiKey
            },
            body   : JSON.stringify(payload),
            signal : AbortSignal.timeout(config.ingestion.timeoutMs)
        });

        if (!response.ok) {
            logger.warn(`ingestion rejected log ${payload.requestId} with status ${response.status}`);
        }
    } catch (error) {
        logger.warn(`could not deliver log ${payload.requestId}: ${error.message}`);
    }
}

function startInference(context) {
    const startedAt = new Date();
    const startTime = Date.now();

    let firstTokenTime = null;

    return {
        markFirstToken() {
            if (!firstTokenTime) {
                firstTokenTime = Date.now();
            }
        },

        finish(result) {
            const timing = {
                startedAt,
                finishedAt         : new Date(),
                latencyMs          : Date.now() - startTime,
                timeToFirstTokenMs : firstTokenTime ? firstTokenTime - startTime : null
            };

            sendLog(buildPayload(context, timing, result));
        }
    };
}

module.exports = { startInference };
