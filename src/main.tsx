import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import App from './App';
import { AuthProvider } from './lib/auth';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <Theme theme={neutralTheme}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Theme>
  </StrictMode>
);
