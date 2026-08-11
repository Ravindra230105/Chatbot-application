import React, { useState } from 'react';

export default function MessageInput({ disabled, isStreaming, onSend, onStop }) {
    const [draft, setDraft] = useState('');

    function handleSend() {
        const content = draft.trim();

        if (!content) {
            return;
        }

        setDraft('');
        onSend(content);
    }

    function handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="composer">
            <div className="composer-inner">
                <textarea
                    rows={1}
                    value={draft}
                    disabled={disabled}
                    placeholder={disabled ? 'This conversation is closed.' : 'Send a message...'}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                />

                {isStreaming
                    ? <button className="danger" onClick={onStop}>Stop</button>
                    : <button className="primary" onClick={handleSend} disabled={disabled || !draft.trim()}>Send</button>}
            </div>
        </div>
    );
}
