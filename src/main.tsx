import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/global.css';
import { App } from './ui/App';
import { sandboxStore } from './state/sandbox';

if (import.meta.env.DEV) {
  (window as unknown as { sandbox: typeof sandboxStore }).sandbox = sandboxStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
