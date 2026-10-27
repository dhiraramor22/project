import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { I18nProvider } from './i18n';
import { ToastProvider } from './components/ui/ToastProvider';
import { WorkspaceProvider } from './app/WorkspaceProvider';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container was not found in index.html.');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
