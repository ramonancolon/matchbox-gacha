import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // Clear any SW left over from a prior `npm run preview` or production visit
  // on this origin. The prod SW's fetch handler proxies every request, which
  // can stall Vite's `/@vite/client` boot and surface as the recurring
  // `WebSocket connection to 'ws://localhost:3000/' failed` HMR error.
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Remove the static boot shell once React has mounted.
queueMicrotask(() => {
  document.getElementById('app-boot')?.remove();
});
