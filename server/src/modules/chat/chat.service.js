const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const conversationService = require('../conversation/conversation.service');
const { resolveProvider } = require('../../providers');
const { startInference } = require('../../sdk/inferenceLogger');
const {
    CONVERSATION_STATUS,
    MESSAGE_ROLE,
    MESSAGE_STATUS,
    INFERENCE_STATUS
} = require('../../constants');
const { ApiError } = require('../../utils/apiResponse');
const { normalizeHistory } = require('../../utils/helpers');

const SYSTEM_PROMPT = 'You are Ollive Assistant, a concise and helpful chat assistant. Keep answers short and practical.';

function isCancellation(error, signal) {
    return signal.aborted || error.name === 'AbortError';
}

function buildErrorType(error) {
    return error.providerStatus ? `provider_${error.providerStatus}` : 'provider_error';
}

async function streamAssistantReply({ conversationUuid, content, providerName, modelName, signal, onMeta, onDelta }) {
    const conversation = await conversationService.getConversation(conversationUuid);

    if (conversation.status !== CONVERSATION_STATUS.ACTIVE) {
        throw new ApiError(`conversation is ${conversation.status} and cannot accept new messages`, 409);
    }

    const { provider, model } = resolveProvider(providerName || conversation.provider, modelName || conversation.model);

    await conversationService.addMessage({ conversation, role: MESSAGE_ROLE.USER, content });

    const history = await conversationService.getRecentMessages(conversation.id, config.chat.contextMessageLimit);
    const requestId = uuidv4();

    const assistantMessage = await conversationService.addMessage({
        conversation,
        role      : MESSAGE_ROLE.ASSISTANT,
        content   : '',
        status    : MESSAGE_STATUS.STREAMING,
        requestId
    });

    onMeta({
        conversationUuid : conversation.uuid,
        messageUuid      : assistantMessage.uuid,
        requestId,
        provider         : provider.name,
        model
    });

    const tracker = startInference({
        requestId,
        conversationUuid : conversation.uuid,
        messageUuid      : assistantMessage.uuid,
        sessionId        : conversation.sessionId,
        provider         : provider.name,
        model,
        inputText        : content
    });

    let answer = '';
    let usage = null;
    let chunkCount = 0;

    try {
        const stream = provider.streamChat({
            model,
            systemPrompt : SYSTEM_PROMPT,
            messages     : normalizeHistory(history),
            signal
        });

        for await (const chunk of stream) {
            if (chunk.usage) {
                usage = chunk.usage;
                continue;
            }

            tracker.markFirstToken();
            answer += chunk.text;
            chunkCount += 1;
            onDelta(chunk.text);
        }

        await conversationService.updateMessage(assistantMessage, {
            content : answer,
            status  : MESSAGE_STATUS.COMPLETE
        });

        tracker.finish({ status: INFERENCE_STATUS.SUCCESS, outputText: answer, usage, chunkCount });

        return { requestId, messageUuid: assistantMessage.uuid };
    } catch (error) {
        const cancelled = isCancellation(error, signal);

        await conversationService.updateMessage(assistantMessage, {
            content : answer,
            status  : cancelled ? MESSAGE_STATUS.CANCELLED : MESSAGE_STATUS.FAILED
        });

        tracker.finish({
            status       : cancelled ? INFERENCE_STATUS.CANCELLED : INFERENCE_STATUS.ERROR,
            outputText   : answer,
            usage,
            chunkCount,
            errorType    : cancelled ? 'client_cancelled' : buildErrorType(error),
            errorMessage : error.message
        });

        if (cancelled) {
            return { requestId, cancelled: true };
        }

        throw error;
    }
}

module.exports = { streamAssistantReply };
