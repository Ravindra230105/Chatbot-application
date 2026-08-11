import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConversationList from '../components/ConversationList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import useConversations from '../hooks/useConversations';
import {
    cancelConversation,
    createConversation,
    getConversation,
    getProviders,
    streamMessage
} from '../api/conversationApi';

const TOKEN_REFRESH_DELAY_MS = 2000;

export default function ChatPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const { conversations, refresh } = useConversations(statusFilter);

    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedModel, setSelectedModel] = useState('');

    const [selectedUuid, setSelectedUuid] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState('');

    const abortRef = useRef(null);

    useEffect(() => {
        getProviders()
            .then(data => {
                const preferred = data.providers.find(provider => provider.name === data.defaults.provider);
                const usable = preferred && preferred.configured
                    ? preferred
                    : data.providers.find(provider => provider.configured);

                setProviders(data.providers);

                if (usable) {
                    setSelectedProvider(usable.name);
                    setSelectedModel(usable.name === data.defaults.provider ? data.defaults.model : usable.models[0]);
                }
            })
            .catch(requestError => setError(requestError.message));
    }, []);

    useEffect(() => {
        if (!selectedUuid && conversations.length) {
            setSelectedUuid(conversations[0].uuid);
        }
    }, [conversations, selectedUuid]);

    const loadConversation = useCallback(async () => {
        if (!selectedUuid) {
            return;
        }

        try {
            const data = await getConversation(selectedUuid);

            setConversation(data.conversation);
            setMessages(data.messages.filter(message => message.content));
        } catch (requestError) {
            setError(requestError.message);
        }
    }, [selectedUuid]);

    useEffect(() => {
        setStreamingText('');
        setError('');
        loadConversation();
    }, [loadConversation]);

    function handleProviderChange(providerName) {
        const provider = providers.find(item => item.name === providerName);

        setSelectedProvider(providerName);
        setSelectedModel(provider ? provider.models[0] : '');
    }

    async function handleCreate() {
        try {
            const created = await createConversation({ provider: selectedProvider, model: selectedModel });

            await refresh();
            setSelectedUuid(created.uuid);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleCancelConversation(uuid) {
        try {
            await cancelConversation(uuid);
            await refresh();
            await loadConversation();
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function handleSend(content) {
        setError('');
        setStreamingText('');
        setIsStreaming(true);
        setMessages(current => [...current, { uuid: `temp-${Date.now()}`, role: 'user', content, status: 'complete' }]);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await streamMessage({
                uuid     : selectedUuid,
                content,
                provider : selectedProvider,
                model    : selectedModel,
                signal   : controller.signal,
                onEvent  : (event, data) => {
                    if (event === 'delta') {
                        setStreamingText(current => current + data.text);
                    }

                    if (event === 'error') {
                        setError(data.message);
                    }
                }
            });
        } catch (requestError) {
            if (requestError.name !== 'AbortError') {
                setError(requestError.message);
            }
        } finally {
            abortRef.current = null;
            setIsStreaming(false);
            setStreamingText('');

            await loadConversation();
            await refresh();

            setTimeout(() => {
                loadConversation();
                refresh();
            }, TOKEN_REFRESH_DELAY_MS);
        }
    }

    function handleStop() {
        if (abortRef.current) {
            abortRef.current.abort();
        }
    }

    return (
        <div className="chat-page">
            <ConversationList
                conversations={conversations}
                selectedUuid={selectedUuid}
                statusFilter={statusFilter}
                providers={providers}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onStatusFilterChange={setStatusFilter}
                onProviderChange={handleProviderChange}
                onModelChange={setSelectedModel}
                onSelect={setSelectedUuid}
                onCreate={handleCreate}
                onCancel={handleCancelConversation}
            />

            <section className="chat-main">
                {!selectedUuid ? (
                    <div className="empty-state">
                        <strong>No conversation selected</strong>
                        <span>Create a new conversation to start chatting.</span>
                    </div>
                ) : (
                    <>
                        {error && <div className="alert" style={{ margin: 16 }}>{error}</div>}

                        <MessageList messages={messages} streamingText={streamingText} isStreaming={isStreaming} />

                        <MessageInput
                            disabled={Boolean(conversation && conversation.status !== 'active')}
                            isStreaming={isStreaming}
                            onSend={handleSend}
                            onStop={handleStop}
                        />
                    </>
                )}
            </section>
        </div>
    );
}
