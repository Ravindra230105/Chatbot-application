const chatService = require('./chat.service');
const { SSE_EVENT } = require('../../constants');
const { openStream, writeEvent } = require('../../utils/sse');

async function sendMessage(req, res, next) {
    const controller = new AbortController();

    res.on('close', () => {
        if (!res.writableEnded) {
            controller.abort();
        }
    });

    try {
        await chatService.streamAssistantReply({
            conversationUuid : req.params.uuid,
            content          : req.body.content,
            providerName     : req.body.provider,
            modelName        : req.body.model,
            signal           : controller.signal,
            onMeta           : data => {
                openStream(res);
                writeEvent(res, SSE_EVENT.META, data);
            },
            onDelta : text => writeEvent(res, SSE_EVENT.DELTA, { text })
        });

        writeEvent(res, SSE_EVENT.DONE, { finished: true });

        return res.end();
    } catch (error) {
        if (!res.headersSent) {
            return next(error);
        }

        writeEvent(res, SSE_EVENT.ERROR, { message: error.message });

        return res.end();
    }
}

module.exports = { sendMessage };
