import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
            </Route>
        </Routes>
    );
}
