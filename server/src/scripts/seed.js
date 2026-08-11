const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

const BASE_URL = `http://127.0.0.1:${config.port}`;
const TURN_DELAY_MS = Number(process.env.SEED_TURN_DELAY_MS || 1500);

const SCRIPTS = [
    { turns: ['What does p95 latency measure?', 'How is that different from the average?'] },
    { turns: ['Summarise how token usage is billed.', 'Which part of that is the prompt cost?'] },
    { turns: ['My email is priya.sharma@example.com and my number is 9876543210'] },
    { turns: ['Name three things worth logging about an LLM call.'] },
    { turns: ['Write a long, detailed explanation of how HTTP streaming works.'], cancelAfterMs: 400 }
];

async function createConversation(sessionId) {
    const response = await fetch(`${BASE_URL}/api/conversations`, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body    : JSON.stringify({})
    });

    const body = await response.json();

    if (!response.ok) {
        throw new Error(body.message || 'could not create conversation');
    }

    return body.data;
}

async function sendMessage(conversationUuid, sessionId, content, cancelAfterMs) {
    const controller = new AbortController();

    if (cancelAfterMs) {
        setTimeout(() => controller.abort(), cancelAfterMs);
    }

    try {
        const response = await fetch(`${BASE_URL}/api/conversations/${conversationUuid}/messages`, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json', 'x-session-id': sessionId },
            body    : JSON.stringify({ content }),
            signal  : controller.signal
        });

        const reader = response.body.getReader();

        while (true) {
            const { done } = await reader.read();

            if (done) {
                break;
            }
        }

        return 'completed';
    } catch (error) {
        return error.name === 'AbortError' ? 'cancelled' : `failed (${error.message})`;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const sessionId = uuidv4();

    logger.info(`seeding sample traffic against ${BASE_URL}`);

    for (const script of SCRIPTS) {
        const conversation = await createConversation(sessionId);

        for (const turn of script.turns) {
            const outcome = await sendMessage(conversation.uuid, sessionId, turn, script.cancelAfterMs);

            logger.info(`${outcome}: ${turn.slice(0, 50)}`);

            await sleep(TURN_DELAY_MS);
        }
    }

    logger.info('seeding finished, open the dashboard to see the logs');
}

run().catch(error => {
    logger.error('seeding failed', error);
    process.exit(1);
});
