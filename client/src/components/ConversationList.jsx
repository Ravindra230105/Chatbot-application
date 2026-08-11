import React from 'react';
import { CONVERSATION_FILTERS } from '../utils/constants';
import { formatNumber, formatRelativeTime } from '../utils/format';

export default function ConversationList({
    conversations,
    selectedUuid,
    statusFilter,
    providers,
    selectedProvider,
    selectedModel,
    onStatusFilterChange,
    onProviderChange,
    onModelChange,
    onSelect,
    onCreate,
    onCancel
}) {
    const activeProvider = providers.find(provider => provider.name === selectedProvider);
    const readyProviders = providers.filter(provider => provider.configured);
    const unavailableProviders = providers.filter(provider => !provider.configured);

    return (
        <aside className="sidebar">
            <div className="sidebar-block">
                <button className="primary block" onClick={onCreate}>New conversation</button>
            </div>

            <div className="sidebar-block">
                <span className="block-title">Model settings</span>

                <div className="field">
                    <label htmlFor="provider-select">Provider</label>
                    <select id="provider-select" value={selectedProvider} onChange={event => onProviderChange(event.target.value)}>
                        {readyProviders.map(provider => (
                            <option key={provider.name} value={provider.name}>{provider.label}</option>
                        ))}

                        {unavailableProviders.length > 0 && (
                            <optgroup label="Coming soon">
                                {unavailableProviders.map(provider => (
                                    <option key={provider.name} value={provider.name} disabled>
                                        {provider.label}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                <div className="field">
                    <label htmlFor="model-select">Model</label>
                    <select id="model-select" value={selectedModel} onChange={event => onModelChange(event.target.value)}>
                        {(activeProvider ? activeProvider.models : []).map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                </div>

                <p className="field-hint">
                    {readyProviders.length
                        ? 'Applies to the next message you send.'
                        : 'No provider is configured. Add an API key to server/.env and restart.'}
                </p>
            </div>

            <div className="sidebar-block">
                <div className="block-head">
                    <span className="block-title">Conversations</span>
                    <span className="count">{conversations.length}</span>
                </div>

                <div className="field">
                    <label htmlFor="filter-select">Show</label>
                    <select id="filter-select" value={statusFilter} onChange={event => onStatusFilterChange(event.target.value)}>
                        {CONVERSATION_FILTERS.map(filter => (
                            <option key={filter.value} value={filter.value}>{filter.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="conversation-list">
                {!conversations.length && (
                    <p className="list-empty">
                        Nothing here yet. Start a new conversation to see it listed.
                    </p>
                )}

                {conversations.map(conversation => (
                    <div
                        key={conversation.uuid}
                        className={`conversation-item ${conversation.uuid === selectedUuid ? 'selected' : ''}`}
                        onClick={() => onSelect(conversation.uuid)}
                    >
                        <div className="conversation-head">
                            <h4>{conversation.title}</h4>
                            {conversation.status !== 'active' && (
                                <span className={`badge ${conversation.status}`}>{conversation.status}</span>
                            )}
                        </div>

                        <div className="conversation-meta">
                            <span>{formatRelativeTime(conversation.lastMessageAt)}</span>
                            <span className="dot">·</span>
                            <span>{formatNumber(conversation.messageCount)} messages</span>
                            <span className="dot">·</span>
                            <span>{formatNumber(conversation.totalTokens)} tokens</span>
                        </div>

                        {conversation.status === 'active' && conversation.uuid === selectedUuid && (
                            <button
                                className="danger small"
                                onClick={event => {
                                    event.stopPropagation();
                                    onCancel(conversation.uuid);
                                }}
                            >
                                Cancel conversation
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </aside>
    );
}
