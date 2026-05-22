import { StrictMode } from 'react';

// Fallback for crypto.randomUUID in non-secure origins (HTTP)
if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
  // @ts-ignore
  window.crypto.randomUUID = function() {
    return (([1e7] as any)+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: any) =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}
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
