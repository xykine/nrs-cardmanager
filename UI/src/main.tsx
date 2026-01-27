import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminAuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AdminAuthProvider>
  </StrictMode>
);
