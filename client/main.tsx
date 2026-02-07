import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // Ensure this path matches your file structure
import './global.css';
import { HashRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* We use HashRouter to fix the 404 error on GitHub Pages */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
