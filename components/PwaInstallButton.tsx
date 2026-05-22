import React, { useEffect, useMemo, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export const PwaInstallButton: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('ecotransport-install-dismissed') === 'true');
  const isStandalone = useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setShowManualHint(false);
      setDismissed(true);
      localStorage.setItem('ecotransport-install-dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
      return;
    }

    setShowManualHint(true);
  };

  const close = () => {
    setDismissed(true);
    localStorage.setItem('ecotransport-install-dismissed', 'true');
  };

  return (
    <div className="fixed right-5 bottom-5 z-[220] max-w-[320px]">
      <div className="bg-emerald-950 text-white border border-emerald-300/20 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">Instalar app</div>
            <p className="text-xs leading-relaxed text-white/75 mt-1">
              Agrega EcoTransport a tu celular para abrirlo como aplicación.
            </p>
          </div>
          <button onClick={close} className="p-1 rounded-lg text-white/45 hover:text-white hover:bg-white/10" aria-label="Ocultar instalador">
            <X className="w-4 h-4" />
          </button>
        </div>
        {showManualHint ? (
          <div className="px-4 pb-4 text-[11px] leading-relaxed text-emerald-50/85">
            {isIosDevice() ? (
              <>En iPhone: toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.</>
            ) : (
              <>En Android/Chrome: abre el menu del navegador y toca <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4">
            <button
              onClick={install}
              className="w-full bg-emerald-400 text-emerald-950 py-3 rounded-xl font-black text-[11px] uppercase tracking-[0.16em] hover:bg-emerald-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar app
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
