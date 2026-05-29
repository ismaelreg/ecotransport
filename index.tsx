
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ecotransport] Error de arranque recuperable', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-emerald-950 text-white flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 text-gray-900 shadow-2xl border border-emerald-200">
          <h1 className="text-2xl font-black uppercase tracking-tight text-emerald-900">EcoTransport</h1>
          <p className="mt-3 text-sm font-semibold text-gray-600">
            La app encontro datos locales incompletos. Puedes restablecerlos y volver a cargar sin perder tu cuenta.
          </p>
          <button
            type="button"
            onClick={() => {
              ['cargo_items', 'cargo_history', 'cargo_spaces', 'cargo_route', 'cargo_setup_done'].forEach((key) => localStorage.removeItem(key));
              window.location.reload();
            }}
            className="mt-6 w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-emerald-800"
          >
            Restablecer y cargar
          </button>
        </section>
      </main>
    );
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || './';
    navigator.serviceWorker.register(`${baseUrl}sw.js`).catch((error) => {
      console.warn('[ecotransport] No se pudo registrar el service worker', error);
    });
  });
}
