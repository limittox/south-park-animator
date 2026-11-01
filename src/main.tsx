import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles.css';
import App from './App';
import { installFlatStyle } from './character/flat';

installFlatStyle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
