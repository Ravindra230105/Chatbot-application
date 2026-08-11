function openStream(res) {
    if (res.headersSent) {
        return;
    }

    res.writeHead(200, {
        'Content-Type'      : 'text/event-stream',
        'Cache-Control'     : 'no-cache, no-transform',
        'Connection'        : 'keep-alive',
        'X-Accel-Buffering' : 'no'
    });
    res.flushHeaders();
}

function writeEvent(res, event, data) {
    if (res.writableEnded) {
        return;
    }

    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

module.exports = { openStream, writeEvent };
