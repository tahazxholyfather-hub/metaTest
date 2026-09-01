import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UserProvider } from './context/UserContext';
import { SocketProvider } from './socket/SocketProvider';
import './utils/mathjax';
import { TourProvider } from './context/TourContext';


ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <UserProvider>
            <SocketProvider>
                <TourProvider>
                <App />
                </TourProvider>
            </SocketProvider>
        </UserProvider>
    </React.StrictMode>
);
