import axios from 'axios';
import { getSessionId } from '../utils/session';

const axiosClient = axios.create({
    baseURL : '/api',
    headers : { 'Content-Type': 'application/json' }
});

axiosClient.interceptors.request.use(config => {
    config.headers['x-session-id'] = getSessionId();

    return config;
});

axiosClient.interceptors.response.use(
    response => response.data.data,
    error => {
        const message = error.response?.data?.message || error.message;

        return Promise.reject(new Error(message));
    }
);

export default axiosClient;
