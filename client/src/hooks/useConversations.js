import { useCallback, useEffect, useState } from 'react';
import { getConversations } from '../api/conversationApi';

export default function useConversations(statusFilter) {
    const [conversations, setConversations] = useState([]);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        try {
            const data = await getConversations(statusFilter ? { status: statusFilter } : {});

            setConversations(data);
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }, [statusFilter]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { conversations, error, refresh };
}
