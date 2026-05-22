
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || './';
    navigator.serviceWorker.register(`${baseUrl}sw.js`).catch((error) => {
      console.warn('[ecotransport] No se pudo registrar el service worker', error);
    });
  });
}
