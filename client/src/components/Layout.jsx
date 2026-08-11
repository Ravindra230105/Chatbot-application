import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
    return (
        <div className="layout">
            <header className="header">
                <div className="brand">
                    <img src="/logo.png" alt="Ollive" className="brand-logo" />
                    <div>
                        <h1>Ollive Inference Console</h1>
                        <p>Streaming chat with inference metrics</p>
                    </div>
                </div>
                <nav className="nav">
                    <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>Chat</NavLink>
                    <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
                </nav>
            </header>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}
