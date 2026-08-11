import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MessageContent({ content, role }) {
    if (role === 'user') {
        return <div className="bubble">{content}</div>;
    }

    return (
        <div className="bubble markdown">
            <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a : props => <a {...props} target="_blank" rel="noopener noreferrer" />
                }}
            >
                {content}
            </Markdown>
        </div>
    );
}
