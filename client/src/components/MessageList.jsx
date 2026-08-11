import React, { useEffect, useRef } from 'react';
import MessageContent from './MessageContent';
import { formatNumber } from '../utils/format';

export default function MessageList({ messages, streamingText, isStreaming }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ block: 'end' });
        }
    }, [messages, streamingText]);

    return (
        <div className="messages">
            {messages.map(message => (
                <div key={message.uuid} className={`message ${message.role}`}>
                    <MessageContent content={message.content} role={message.role} />

                    {message.role === 'assistant' && (
                        <div className="message-meta">
                            <span className={`badge ${message.status}`}>{message.status}</span>
                            {message.tokenCount !== null && <span>{formatNumber(message.tokenCount)} output tokens</span>}
                            {message.requestId && <span>request {message.requestId.slice(0, 8)}</span>}
                        </div>
                    )}
                </div>
            ))}

            {isStreaming && (
                <div className="message assistant">
                    {streamingText
                        ? <MessageContent content={streamingText} role="assistant" />
                        : <div className="bubble">Thinking...</div>}
                    <div className="message-meta">
                        <span className="badge">streaming</span>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
