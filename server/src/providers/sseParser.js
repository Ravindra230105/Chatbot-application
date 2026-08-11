async function* parseSseStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (!line.startsWith('data:')) {
                continue;
            }

            const raw = line.slice(5).trim();

            if (!raw || raw === '[DONE]') {
                continue;
            }

            try {
                yield JSON.parse(raw);
            } catch (error) {
                continue;
            }
        }
    }
}

module.exports = { parseSseStream };
