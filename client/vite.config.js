import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:5000';

export default defineConfig({
    plugins : [react()],
    server  : {
        host  : true,
        port  : 5173,
        proxy : {
            '/api' : { target: API_URL, changeOrigin: true }
        }
    }
});
