import axiosClient from './axiosClient';
import { getSessionId } from '../utils/session';

export function getProviders() {
    return axiosClient.get('/providers');
}

export function createConversation(payload) {
    return axiosClient.post('/conversations', payload);
}

export function getConversations(params) {
    return axiosClient.get('/conversations', { params });
}

export function getConversation(uuid) {
    return axiosClient.get(`/conversations/${uuid}`);
}

export function cancelConversation(uuid) {
    return axiosClient.post(`/conversations/${uuid}/cancel`);
}

export async function streamMessage({ uuid, content, provider, model, signal, onEvent }) {
    const response = await fetch(`/api/conversations/${uuid}/messages`, {
        method  : 'POST',
        headers : {
            'Content-Type'  : 'application/json',
            'x-session-id'  : getSessionId()
        },
        body : JSON.stringify({ content, provider, model }),
        signal
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));

        throw new Error(body.message || `request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop();

        blocks.forEach(block => {
            const eventLine = block.split('\n').find(line => line.startsWith('event:'));
            const dataLine = block.split('\n').find(line => line.startsWith('data:'));

            if (eventLine && dataLine) {
                onEvent(eventLine.replace('event:', '').trim(), JSON.parse(dataLine.replace('data:', '').trim()));
            }
        });
    }
}
