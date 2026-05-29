
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Menu, HelpCircle, Settings, Plus, Package, Truck, FileText, Share2, 
  Trash2, RefreshCw, Weight, X, FileJson, User, Sparkles, 
  Loader2, Filter, Camera, Maximize2, Box, Video, LogOut, ShoppingCart,
  PlusSquare, Edit, CreditCard, BookOpen, CheckCircle2, AlertCircle, Search,
  Printer, ClipboardList, Info, ChevronRight, MessageSquare, Leaf, Wind, Zap,
  Globe, BarChart3, Navigation, AlertTriangle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Container, CargoItem, PlacedItem, CONTAINERS, Route } from './types';
import { packItemsDetailed } from './utils/packer';
import { Container3D } from './components/Container3D';
import { ItemEditor } from './components/ItemEditor';
import { InitialSetup } from './components/InitialSetup';
import { RouteSelector } from './components/RouteSelector';
import { PwaInstallButton } from './components/PwaInstallButton';
import { getLoadOptimizationAdvice } from './services/geminiService';
import { isSupabaseConfigured, supabase } from './services/supabaseClient';

type ViewType = 'simulador' | 'cargas' | 'items' | 'espacio' | 'usuarios' | 'licencias';
type OverflowRecommendation = {
  status: 'fits' | 'partial';
  container: Container;
  placedCount: number;
  unplacedCount: number;
};

const APP_BRAND = 'EcoTransport';
const APP_TAGLINE = 'Cubicaje 3D sustentable para PyMEs logisticas';
const APP_BADGE = 'NEMFIS Green Logistics';
const CURRENT_USER = {
  name: 'Ismael',
  email: 'ireyes@NEMFIS.MX'
};
const AUTH_PASSWORD = '3.1416';
const APP_LOGO = `${import.meta.env.BASE_URL || './'}icons/eco-transport-logo.jpeg`;

const DEFAULT_ITEMS: CargoItem[] = [
  { id: 'A', name: 'Item A', length: 120, width: 80, height: 100, weight: 25, quantity: 15, color: '#f87171', stackable: true, tiltable: false },
  { id: 'B', name: 'Item B', length: 60, width: 40, height: 40, weight: 12, quantity: 40, color: '#fbbf24', stackable: true, tiltable: true }
];

const DEFAULT_ROUTE: Route = { origin: null, destination: null, distanceKm: 0 };

const readStoredValue = <T,>(key: string, fallback: T, validate?: (value: unknown) => value is T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as unknown;
    if (validate && !validate(parsed)) {
      localStorage.removeItem(key);
      return fallback;
    }

    return parsed as T;
  } catch (error) {
    console.warn(`[ecotransport] Estado local invalido en ${key}; se restablece.`, error);
    localStorage.removeItem(key);
    return fallback;
  }
};

const writeStoredValue = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[ecotransport] No se pudo guardar ${key} en localStorage.`, error);
  }
};

const isContainerArray = (value: unknown): value is Container[] => Array.isArray(value);
const isCargoItemArray = (value: unknown): value is CargoItem[] => Array.isArray(value);
const isHistoryArray = (value: unknown): value is any[] => Array.isArray(value);
const isRoute = (value: unknown): value is Route => Boolean(value && typeof value === 'object' && 'distanceKm' in value);

type RemoteAppState = {
  items: CargoItem[];
  container_list: Container[];
  cargas_history: any[];
  route: Route;
  selected_container_id: string | null;
  setup_done: boolean;
};

interface MerchandiseTicketProps {
  setShowTicket: (show: boolean) => void;
  reportData: any;
  setReportData: (data: any) => void;
  selectedContainer: Container;
  metrics: any;
  items: CargoItem[];
  placedItems: PlacedItem[];
  exportToPdf: () => void;
}

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: (name: string, email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSignup }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState(CURRENT_USER.name);
  const [email, setEmail] = useState(CURRENT_USER.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    if (mode === 'signup') {
      const result = await onSignup(name, email, password);
      if (result.ok) {
        setNotice(result.message || 'Cuenta creada. Ya puedes ingresar.');
        setMode('login');
      } else {
        setError(result.message || 'No se pudo crear la cuenta.');
      }
      setIsSubmitting(false);
      return;
    }
    const ok = await onLogin(email, password);
    if (!ok) setError('Usuario o contraseña incorrectos o no registrado en Supabase.');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-emerald-200">
        <div className="bg-emerald-900 text-white p-8">
          <div className="flex items-center gap-3 mb-5">
            <img src={APP_LOGO} alt={`${APP_BRAND} logo`} className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-200 shadow-lg" />
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">{APP_BRAND}</h1>
              <p className="text-[10px] uppercase tracking-widest text-emerald-200">{APP_TAGLINE}</p>
            </div>
          </div>
          <p className="text-sm text-emerald-100 leading-relaxed">
            Acceso seguro al simulador de cubicaje sustentable, impacto de CO2 y optimizacion EP-BFD.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {mode === 'signup' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Nombre completo"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contraseña"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-xs font-bold">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-xs font-bold">
              {notice}
            </div>
          )}
          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-700 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-800 transition-all shadow-lg disabled:opacity-60">
            {isSubmitting ? (mode === 'signup' ? 'Creando...' : 'Ingresando...') : (mode === 'signup' ? 'Crear Cuenta' : 'Ingresar')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setNotice('');
            }}
            className="w-full text-[11px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
          >
            {mode === 'login' ? 'Crear usuario nuevo' : 'Ya tengo cuenta'}
          </button>
          <div className="text-[10px] text-gray-400 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
            {mode === 'login' ? `Acceso de prueba: ${CURRENT_USER.email} / ${AUTH_PASSWORD}` : 'La cuenta se registrara en Supabase Auth.'}
          </div>
        </form>
      </div>
    </div>
  );
};

const MerchandiseTicket: React.FC<MerchandiseTicketProps> = ({
  setShowTicket,
  reportData,
  setReportData,
  selectedContainer,
  metrics,
  items,
  placedItems,
  exportToPdf
}) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
      <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-300" />
          <h3 className="font-black uppercase tracking-tighter italic">Manifiesto Sustentable de Carga</h3>
        </div>
        <button onClick={() => setShowTicket(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8 bg-[#fafafa]">
        <div className="flex justify-between items-start border-b-2 border-gray-100 pb-8 mb-8">
          <div className="flex items-center gap-4">
            <img src={APP_LOGO} alt={`${APP_BRAND} logo`} className="w-20 h-20 rounded-2xl object-cover border border-emerald-100 shadow-md" />
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-gray-800 italic uppercase">{APP_BRAND}</h1>
              <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">{APP_TAGLINE}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha de Emisión</div>
            <div className="text-sm font-bold text-gray-800">{new Date().toLocaleString()}</div>
            <div className="mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID de Carga</div>
            <div className="text-sm font-bold text-emerald-600 font-mono">#ECO-{Date.now().toString().slice(-6)}</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm mb-8">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Información del Cliente</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Cliente</label>
              <input 
                type="text" 
                value={reportData.cliente}
                onChange={(e) => setReportData({...reportData, cliente: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Teléfono</label>
              <input 
                type="text" 
                value={reportData.telefono}
                onChange={(e) => setReportData({...reportData, telefono: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
                placeholder="Teléfono de contacto"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Dirección</label>
              <textarea 
                value={reportData.direccion}
                onChange={(e) => setReportData({...reportData, direccion: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold h-16 resize-none"
                placeholder="Dirección de entrega"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Espacio de Carga</div>
            <div className="font-bold text-gray-800">{selectedContainer.name}</div>
            <div className="text-[10px] text-gray-500 italic uppercase">{selectedContainer.type}</div>
          </div>
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Capacidad Máxima</div>
            <div className="font-bold text-emerald-600">{selectedContainer.maxWeight.toLocaleString()} kg</div>
          </div>
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Carga Actual</div>
            <div className="font-bold text-blue-600">{metrics.placedWeight.toLocaleString()} kg</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg shadow-sm">
            <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Eficiencia de Carbono (LCEI)</div>
            <div className="flex items-center gap-2">
              <div className="font-bold text-emerald-700 text-xl">{metrics.sustainability.lcei.toFixed(0)}%</div>
              <div className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded italic">RATING {metrics.sustainability.rating}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-full">
              <Leaf className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CO2 Estimado</div>
              <div className="text-xl font-black text-gray-800">{metrics.sustainability.co2Estimated.toFixed(2)} <span className="text-xs text-gray-400">kg</span></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Wind className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CO2 Evitado por Consolidacion</div>
              <div className="text-xl font-black text-emerald-600">{metrics.sustainability.co2Avoided.toFixed(2)} <span className="text-xs text-gray-400">kg</span></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diesel Evitado</div>
              <div className="text-xl font-black text-emerald-600">{metrics.fuelAvoided.toFixed(1)} <span className="text-xs text-gray-400">L</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9fa] border-b border-gray-200">
              <tr>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter">Descripción</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">LO (cm)</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">AN (cm)</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">AL (cm)</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-right">Peso Un.</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">Cant.</th>
                <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-right">Peso Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                let rowIndex = 0;
                return items.map(i => {
                  const placedOfThisType = placedItems.filter(p => p.id.startsWith(i.id)).length;
                  if (placedOfThisType === 0) return null;
                  const currentIdx = rowIndex++;
                  return (
                    <tr key={i.id} className={`hover:bg-blue-50/50 transition-colors ${currentIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="p-4 font-bold text-gray-800 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: i.color }}></div>
                        {i.name}
                      </td>
                      <td className="p-4 text-center font-mono font-medium text-gray-500">{i.length}</td>
                      <td className="p-4 text-center font-mono font-medium text-gray-500">{i.width}</td>
                      <td className="p-4 text-center font-mono font-medium text-gray-500">{i.height}</td>
                      <td className="p-4 text-right font-mono font-bold text-gray-700">{i.weight} kg</td>
                      <td className="p-4 text-center font-black text-blue-600 text-sm">{placedOfThisType}</td>
                      <td className="p-4 text-right font-black text-gray-900 text-sm">{(i.weight * placedOfThisType).toLocaleString()} kg</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot className="bg-gray-50/80 font-black border-t-2 border-gray-200">
              <tr>
                <td colSpan={5} className="p-4 text-right text-gray-400 uppercase tracking-widest text-[10px]">Totales Cargados</td>
                <td className="p-4 text-center text-blue-600 text-base">{placedItems.length}</td>
                <td className="p-4 text-right text-gray-900 text-base">{metrics.placedWeight.toLocaleString()} kg</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
            <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-4">Métricas de Optimización Real</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-blue-600 text-[11px] font-bold">Volumen Utilizado</span>
                <span className="text-blue-900 font-black">{metrics.placedVol.toFixed(2)} m³</span>
              </div>
              <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                <span className="text-blue-600 text-[11px] font-bold">Porcentaje de Uso</span>
                <span className="text-blue-900 font-black">{metrics.utilization.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-600 text-[11px] font-bold">Espacio Libre</span>
                <span className="text-blue-900 font-black">{(metrics.containerVol - metrics.placedVol).toFixed(2)} m³</span>
              </div>
            </div>
          </div>
          <div className="border-2 border-dashed border-gray-200 p-6 rounded-xl flex flex-col justify-center items-center text-center">
             {metrics.unplacedCount > 0 ? (
               <>
                 <AlertCircle className="w-8 h-8 text-orange-400 mb-2" />
                 <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest italic">Artículos sin espacio</span>
                 <p className="text-[11px] font-bold text-gray-400 mt-1">{metrics.unplacedCount} ítems no pudieron cargarse por falta de espacio físico.</p>
               </>
             ) : (
               <>
                 <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                 <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Carga Completa</span>
                 <p className="text-[11px] font-bold text-gray-400 mt-1">Todos los artículos del inventario han sido posicionados.</p>
               </>
             )}
          </div>
        </div>

        <div className="p-6 bg-emerald-900 text-white rounded-xl flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border-4 border-emerald-400 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-lg font-black italic uppercase tracking-tighter">Certificación Eco-Logística</h4>
              <p className="text-xs text-emerald-200 font-medium max-w-md">Esta carga combate el transporte de aire, consolida volumen util y disminuye consumo de combustibles fosiles frente a una operacion con baja cubica.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Base normativa</div>
            <div className="text-sm font-black italic">NOM-012 / ISO-14001 / ISO-9001</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Detalles de Pago y Notas</h4>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Forma de Pago</label>
              <select 
                value={reportData.formaPago}
                onChange={(e) => setReportData({...reportData, formaPago: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
              >
                <option>Efectivo</option>
                <option>Tarjeta</option>
                <option>Transferencia</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Abono</label>
              <input 
                type="text" 
                value={reportData.abono}
                onChange={(e) => setReportData({...reportData, abono: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
                placeholder="$ 0.00"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Valor Pendiente</label>
              <input 
                type="text" 
                value={reportData.valorPendiente}
                onChange={(e) => setReportData({...reportData, valorPendiente: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold"
                placeholder="$ 0.00"
              />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Notas del Pedido</label>
              <textarea 
                value={reportData.notas}
                onChange={(e) => setReportData({...reportData, notas: e.target.value})}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold h-24"
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
        <button onClick={() => window.print()} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-gray-300 flex items-center gap-2">
          <Printer className="w-4 h-4" /> Imprimir Ticket
        </button>
        <button onClick={exportToPdf} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg flex items-center gap-2">
          <FileText className="w-4 h-4" /> Descargar PDF
        </button>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !isSupabaseConfigured && localStorage.getItem('ecotransport_auth') === 'true');
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(isSupabaseConfigured);
  const [isRemoteStateReady, setIsRemoteStateReady] = useState(!isSupabaseConfigured);
  const [activeView, setActiveView] = useState<ViewType>('simulador');
  const [showSetup, setShowSetup] = useState(() => localStorage.getItem('cargo_setup_done') !== 'true');
  const [showWeightHeatmap, setShowWeightHeatmap] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [showUtils, setShowUtils] = useState(false);
  const [showBottomUtils, setShowBottomUtils] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [cameraView, setCameraView] = useState<'iso' | 'front'>('iso');
  const [customSpace, setCustomSpace] = useState({
    name: 'Unidad sustentable personalizada',
    length: 1200,
    width: 240,
    height: 240,
    maxWeight: 24000,
    type: 'container' as Container['type']
  });
  const [reportData, setReportData] = useState({
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: '',
    telefono: '',
    direccion: '',
    notas: '',
    abono: '',
    valorPendiente: '',
    formaPago: 'Efectivo'
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [route, setRoute] = useState<Route>(() => readStoredValue('cargo_route', DEFAULT_ROUTE, isRoute));

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [showSustainabilityDrawer, setShowSustainabilityDrawer] = useState(false);
  const [showCapacitySummary, setShowCapacitySummary] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'weight' | 'volume'>('name');

  const [containerList, setContainerList] = useState<Container[]>(() => {
    const savedContainers = readStoredValue('cargo_spaces', CONTAINERS, isContainerArray);
    if (!savedContainers.length) return CONTAINERS;

    const savedById = new Map(savedContainers.map((container) => [container.id, container]));
    const defaultIds = new Set(CONTAINERS.map((container) => container.id));
    const customContainers = savedContainers.filter((container) => !defaultIds.has(container.id));
    return [...CONTAINERS.map((container) => savedById.get(container.id) || container), ...customContainers];
  });

  const [selectedContainer, setSelectedContainer] = useState<Container>(
    () => containerList.find((container) => container.type === 'truck') || containerList[1]
  );
  const [filterType, setFilterType] = useState<Container['type'] | 'all'>('all');

  const [items, setItems] = useState<CargoItem[]>(() => readStoredValue('cargo_items', DEFAULT_ITEMS, isCargoItemArray));

  const [cargasHistory, setCargasHistory] = useState<any[]>(() => readStoredValue('cargo_history', [], isHistoryArray));

  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [packingItems, setPackingItems] = useState<CargoItem[]>(items);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPackingItems(items);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [items]);

  const packingResult = useMemo(
    () => packItemsDetailed(selectedContainer, packingItems),
    [selectedContainer, packingItems]
  );

  const overflowRecommendation = useMemo<OverflowRecommendation | null>(() => {
    if (packingResult.unplacedItems.length === 0) return null;

    const vehicleCandidates = containerList
      .filter((container) => container.id !== selectedContainer.id)
      .filter((container) => container.type !== 'pallet')
      .map((container) => {
        const result = packItemsDetailed(container, packingResult.unplacedItems);
        return {
          container,
          result,
          volume: container.length * container.width * (container.height || 450),
        };
      })
      .sort((a, b) => a.volume - b.volume || a.container.maxWeight - b.container.maxWeight);

    const exactFit = vehicleCandidates.find(({ result }) => result.unplacedCount === 0);
    if (exactFit) {
      return {
        status: 'fits',
        container: exactFit.container,
        placedCount: packingResult.unplacedCount,
        unplacedCount: 0,
      };
    }

    const bestPartial = [...vehicleCandidates].sort((a, b) => {
      const placedA = packingResult.unplacedCount - a.result.unplacedCount;
      const placedB = packingResult.unplacedCount - b.result.unplacedCount;
      return placedB - placedA || a.volume - b.volume || a.container.maxWeight - b.container.maxWeight;
    })[0];

    if (!bestPartial) return null;

    return {
      status: 'partial',
      container: bestPartial.container,
      placedCount: packingResult.unplacedCount - bestPartial.result.unplacedCount,
      unplacedCount: bestPartial.result.unplacedCount,
    };
  }, [containerList, packingResult, selectedContainer.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsAuthChecking(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      setAuthUserId(user?.id || null);
      setIsAuthenticated(Boolean(user));
      setIsAuthChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAuthUserId(user?.id || null);
      setIsAuthenticated(Boolean(user));
      setIsRemoteStateReady(!isSupabaseConfigured || !user);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const valid = email.trim().toLowerCase() === CURRENT_USER.email.toLowerCase() && password === AUTH_PASSWORD;
      if (valid) {
        localStorage.setItem('ecotransport_auth', 'true');
        setIsAuthenticated(true);
      }
      return valid;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) return false;
    setAuthUserId(data.user.id);
    setIsAuthenticated(true);
    return true;
  }, []);

  const handleSignup = useCallback(async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { ok: false, message: 'Supabase no esta configurado para crear usuarios.' };
    }

    if (!email.trim() || !password.trim()) {
      return { ok: false, message: 'Correo y contraseña son obligatorios.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim() || email.trim(),
          company: APP_BADGE,
        },
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: name.trim() || email.trim(),
        company: APP_BADGE,
        updated_at: new Date().toISOString(),
      });
    }

    if (data.session?.user) {
      setAuthUserId(data.session.user.id);
      setIsAuthenticated(true);
      return { ok: true, message: 'Cuenta creada e iniciada correctamente.' };
    }

    return { ok: true, message: 'Cuenta creada. Revisa tu correo si Supabase solicita confirmacion.' };
  }, []);

  const handleLogout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      setAuthUserId(null);
      setIsRemoteStateReady(false);
    }
    localStorage.removeItem('ecotransport_auth');
    setIsAuthenticated(false);
  }, []);

  const selectFirstContainerByType = useCallback((type: Container['type']) => {
    const found = containerList.find((container) => container.type === type);
    if (found) {
      setSelectedContainer(found);
      setPlacedItems([]);
      setActiveView('simulador');
    }
  }, [containerList]);

  const addCustomSpace = useCallback(() => {
    const newContainer: Container = {
      id: `custom-${Date.now()}`,
      name: customSpace.name || 'Unidad sustentable personalizada',
      length: Number(customSpace.length) || 1200,
      width: Number(customSpace.width) || 240,
      height: Number(customSpace.height) || 240,
      maxWeight: Number(customSpace.maxWeight) || 24000,
      type: customSpace.type
    };
    setContainerList(prev => [...prev, newContainer]);
    setSelectedContainer(newContainer);
    setPlacedItems([]);
    setActiveView('simulador');
  }, [customSpace]);

  const updateSelectedContainer = useCallback((field: keyof Pick<Container, 'length' | 'width' | 'height' | 'maxWeight'>, value: number) => {
    const safeValue = Math.max(1, Number(value) || 1);
    const updatedContainer = { ...selectedContainer, [field]: safeValue };
    setSelectedContainer(updatedContainer);
    setPlacedItems([]);
    setContainerList(prev => prev.map(container => container.id === selectedContainer.id ? updatedContainer : container));
  }, [selectedContainer]);

  // Sincronización automática de la carga
  useEffect(() => {
    setPlacedItems(packingResult.placedItems);
  }, [packingResult]);

  // Validación de capacidad antes de actualizar items
  const updateItemsWithCapacityCheck = useCallback((newItems: CargoItem[]) => {
    const totalWeight = newItems.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
    
    if (totalWeight > selectedContainer.maxWeight) {
      setCapacityError(`Capacidad excedida: el sobrante se enviara a una unidad recomendada. Limite actual ${selectedContainer.maxWeight.toLocaleString()} kg.`);
      setTimeout(() => setCapacityError(null), 4000);
    } else {
      setCapacityError(null);
    }
    setItems(newItems);
  }, [selectedContainer.maxWeight]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authUserId) return;

    let cancelled = false;

    const loadRemoteState = async () => {
      setIsRemoteStateReady(false);
      const { data, error } = await supabase
        .from('app_state')
        .select('*')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('No se pudo cargar app_state desde Supabase:', error.message);
        setIsRemoteStateReady(true);
        return;
      }

      if (data) {
        const remote = data as RemoteAppState;
        const nextContainers = Array.isArray(remote.container_list) && remote.container_list.length ? remote.container_list : containerList;
        setItems(Array.isArray(remote.items) && remote.items.length ? remote.items : DEFAULT_ITEMS);
        setContainerList(nextContainers);
        setCargasHistory(Array.isArray(remote.cargas_history) ? remote.cargas_history : []);
        setRoute(isRoute(remote.route) ? remote.route : DEFAULT_ROUTE);
        setShowSetup(!remote.setup_done);

        const selected = nextContainers.find((container) => container.id === remote.selected_container_id);
        if (selected) {
          setSelectedContainer(selected);
          setPlacedItems([]);
        }
      }

      setIsRemoteStateReady(true);
    };

    loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  useEffect(() => {
    writeStoredValue('cargo_items', items);
    writeStoredValue('cargo_history', cargasHistory);
    writeStoredValue('cargo_spaces', containerList);
    writeStoredValue('cargo_route', route);

    if (!isSupabaseConfigured || !authUserId || !isRemoteStateReady) return;

    const syncRemoteState = async () => {
      const { error } = await supabase.from('app_state').upsert({
        user_id: authUserId,
        items,
        container_list: containerList,
        cargas_history: cargasHistory,
        route,
        selected_container_id: selectedContainer.id,
        setup_done: !showSetup,
        updated_at: new Date().toISOString(),
      });

      if (error) console.warn('No se pudo guardar app_state en Supabase:', error.message);
    };

    const syncTimer = window.setTimeout(syncRemoteState, 900);
    return () => window.clearTimeout(syncTimer);
  }, [items, cargasHistory, containerList, route, selectedContainer.id, showSetup, authUserId, isRemoteStateReady]);

  // Auto-rellenar dirección en el manifiesto basado en la ruta seleccionada
  useEffect(() => {
    if (route.origin || route.destination) {
      const originStr = route.origin?.address || 'Sin origen';
      const destStr = route.destination?.address || 'Sin destino';
      setReportData(prev => ({
        ...prev,
        direccion: `${originStr} -> ${destStr}`
      }));
    }
  }, [route.origin, route.destination]);

  // Cálculos de métricas basados en LO CARGADO REALMENTE
  const metrics = useMemo(() => {
    const containerVol = (selectedContainer.length * selectedContainer.width * (selectedContainer.height || 450)) / 1000000;
    const placedVol = placedItems.reduce((acc, i) => acc + (i.length * i.width * i.height), 0) / 1000000;
    const placedWeight = placedItems.reduce((acc, i) => acc + i.weight, 0);
    const utilization = containerVol > 0 ? (placedVol / containerVol) * 100 : 0;
    const totalInventoryWeight = items.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
    const totalInventoryVolume = placedVol + packingResult.unplacedVolume;

    // Métricas de Sustentabilidad
    const distanceKm = route.distanceKm > 0 ? route.distanceKm : 500; // Distancia real o promedio
    const emissionFactor = 0.115; // kg CO2 / ton-km (promedio camión pesado)
    const weightTons = placedWeight / 1000;
    const co2Estimated = weightTons * distanceKm * emissionFactor;
    
    // Consumo estimado (litros de diesel)
    // Promedio: 35L / 100km para un camión cargado
    const fullTripFuel = (distanceKm / 100) * 35;
    const loadedWeightRatio = Math.max(0.15, placedWeight / selectedContainer.maxWeight || 0.15);
    const fuelConsumption = fullTripFuel * loadedWeightRatio;

    // Ahorro sustentable: compara contra una operacion con 60% de cubica promedio.
    const baselineUtilization = 60;
    const tripsByVolume = totalInventoryVolume > 0 && containerVol > 0 ? Math.ceil(totalInventoryVolume / containerVol) : 0;
    const tripsByWeight = totalInventoryWeight > 0 && selectedContainer.maxWeight > 0 ? Math.ceil(totalInventoryWeight / selectedContainer.maxWeight) : 0;
    const optimizedTrips = Math.max(tripsByVolume, tripsByWeight, packingResult.unplacedCount > 0 ? 2 : 0);
    const baselineTrips = totalInventoryVolume > 0 && containerVol > 0 ? Math.ceil(totalInventoryVolume / (containerVol * (baselineUtilization / 100))) : 0;
    const tripsAvoided = Math.max(0, baselineTrips - optimizedTrips);
    const fuelPerTrip = fullTripFuel * loadedWeightRatio;
    const fuelAvoided = tripsAvoided * fuelPerTrip;
    const co2Avoided = fuelAvoided * 2.68;
    const overflowWeightRatio = Math.max(0.15, packingResult.unplacedWeight / selectedContainer.maxWeight || 0);
    const overflowFuelRequired = packingResult.unplacedCount > 0 ? fullTripFuel * overflowWeightRatio : 0;
    const overflowCo2Required = overflowFuelRequired * 2.68;

    // LCEI: Logistics Carbon Efficiency Index (0-100)
    // Basado en utilización de volumen y peso
    const weightUtilization = (placedWeight / selectedContainer.maxWeight) * 100;
    const lcei = Math.min(100, (utilization * 0.6) + (weightUtilization * 0.4));

    // Estabilidad (Centro de Gravedad)
    // Calculamos si los ítems más pesados están en la mitad inferior
    const bottomWeight = placedItems.filter(i => i.position[1] < (selectedContainer.height || 240) / 2).reduce((acc, i) => acc + i.weight, 0);
    const stabilityIndex = placedWeight > 0 ? (bottomWeight / placedWeight) * 100 : 0;

    return {
      containerVol,
      placedVol,
      placedWeight,
      utilization,
      totalInventoryWeight,
      totalInventoryVolume,
      unplacedCount: packingResult.unplacedCount,
      unplacedWeight: packingResult.unplacedWeight,
      unplacedVolume: packingResult.unplacedVolume,
      requiredTrips: optimizedTrips,
      overflowFuelRequired,
      overflowCo2Required,
      distanceKm,
      fuelConsumption,
      fuelAvoided,
      tripsAvoided,
      stabilityIndex,
      sustainability: {
        co2Estimated,
        co2Avoided,
        lcei,
        rating: lcei > 85 ? 'A++' : lcei > 75 ? 'A+' : lcei > 60 ? 'A' : lcei > 40 ? 'B' : 'C'
      }
    };
  }, [placedItems, selectedContainer, items, route, packingResult]);

  const handlePack = useCallback(() => {
    const currentPackingResult = packItemsDetailed(selectedContainer, items);
    setPackingItems(items);
    setPlacedItems(currentPackingResult.placedItems);
    const newRecord = {
      id: Date.now().toString(),
      nombre: `Plan sustentable ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      espacio: selectedContainer.name,
      version: '1.0',
      creado: new Date().toLocaleString(),
      usuario: CURRENT_USER.name,
    };
    setCargasHistory(prev => [newRecord, ...prev]);
  }, [selectedContainer, items]);

  const handlePackAndReport = useCallback(() => {
    handlePack();
    setShowTicket(true);
  }, [handlePack]);

  const requestAiAdvice = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    try {
      const advice = await getLoadOptimizationAdvice(selectedContainer, items, placedItems);
      setAiAdvice(advice);
    } catch (error) {
      setAiAdvice("Error al obtener consejos del asistente logístico.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const exportToPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;
    let y = 18;
    const line = (label: string, value: string, x: number, width: number) => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(85, 85, 85);
      doc.text(label.toUpperCase(), x, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      doc.text(doc.splitTextToSize(value || "-", width), x, y + 5);
    };

    doc.setFillColor(6, 78, 59);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("MANIFIESTO SUSTENTABLE DE CARGA", margin, 14);
    doc.setFontSize(9);
    doc.text(`${APP_BRAND} | ${APP_TAGLINE}`, margin, 22);
    doc.setFontSize(8);
    doc.text(`#ECO-${Date.now().toString().slice(-6)}`, pageWidth - margin, 14, { align: 'right' });
    doc.text(new Date().toLocaleString(), pageWidth - margin, 22, { align: 'right' });

    y = 42;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Informacion del cliente y ruta", margin, y);
    y += 8;
    line("Cliente", reportData.cliente || "Nombre del cliente", margin, 80);
    line("Telefono", reportData.telefono || "Telefono de contacto", 112, 70);
    y += 17;
    line("Origen", route.origin?.address || "Sin origen configurado", margin, 80);
    line("Destino / direccion de entrega", reportData.direccion || route.destination?.address || "Sin destino configurado", 112, 70);
    y += 20;
    line("Distancia", route.distanceKm > 0 ? `${route.distanceKm.toFixed(1)} km` : "Pendiente", margin, 55);
    line("Forma de pago", reportData.formaPago, 80, 45);
    line("Abono / pendiente", `${reportData.abono || "$ 0.00"} / ${reportData.valorPendiente || "$ 0.00"}`, 135, 55);

    y += 20;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 3, 3, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumen de cubicaje e impacto", margin + 4, y + 8);
    doc.setFontSize(9);
    const summary = [
      [`Espacio: ${selectedContainer.name}`, `Capacidad: ${selectedContainer.maxWeight.toLocaleString()} kg`],
      [`Items cargados: ${placedItems.length}`, `Peso cargado: ${metrics.placedWeight.toLocaleString()} kg`],
      [`Volumen ocupado: ${metrics.placedVol.toFixed(2)} / ${metrics.containerVol.toFixed(2)} m3`, `Uso: ${metrics.utilization.toFixed(1)}%`],
      [`CO2 evitado: ${metrics.sustainability.co2Avoided.toFixed(2)} kg`, `Diesel evitado: ${metrics.fuelAvoided.toFixed(1)} L`],
      [`Sobrante: ${metrics.unplacedCount} cajas / ${metrics.unplacedVolume.toFixed(2)} m3`, `Viajes requeridos: ${metrics.requiredTrips}`],
      [`CO2 viaje sobrante: ${metrics.overflowCo2Required.toFixed(2)} kg`, `Diesel viaje sobrante: ${metrics.overflowFuelRequired.toFixed(1)} L`],
    ];
    summary.forEach((row, index) => {
      doc.text(row[0], margin + 4, y + 16 + index * 4);
      doc.text(row[1], 112, y + 16 + index * 4);
    });

    y += 53;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text("Items cargados", margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.text("Descripcion", margin + 2, y + 5);
    doc.text("Dimensiones", 75, y + 5);
    doc.text("Cant.", 125, y + 5);
    doc.text("Peso total", 150, y + 5);
    y += 10;

    items.forEach((item) => {
      const placedOfThisType = placedItems.filter((placed) => placed.id.startsWith(item.id)).length;
      if (placedOfThisType === 0) return;
      if (y > 255) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(item.name, 55), margin + 2, y);
      doc.text(`${item.length} x ${item.width} x ${item.height} cm`, 75, y);
      doc.text(String(placedOfThisType), 130, y);
      doc.text(`${(item.weight * placedOfThisType).toLocaleString()} kg`, 150, y);
      y += 8;
    });

    y += 6;
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(`Notas: ${reportData.notas || "Sin observaciones"}`, pageWidth - margin * 2), margin, y);

    doc.save(`Manifiesto_EcoTransport_${Date.now()}.pdf`);
    return;
    
    // Header
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.rect(20, 15, 100, 15); // Box for title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE CARGA", 70, 26, { align: 'center' });
    
    // Logo (Eco Transport)
    doc.setFillColor(76, 175, 80); // Green
    doc.circle(170, 22, 8, 'F');
    doc.setFontSize(10);
    doc.setTextColor(76, 175, 80);
    doc.text("ECO TRANSPORT", 170, 35, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Client Info Section
    doc.rect(20, 40, 170, 60);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha de entrega:", 25, 50);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.fechaEntrega || "________________________________________________", 65, 50);
    doc.line(65, 51, 185, 51);

    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 25, 60);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.cliente || "______________________________________________________", 45, 60);
    doc.line(45, 61, 185, 61);

    doc.setFont("helvetica", "bold");
    doc.text("Teléfono:", 25, 70);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.telefono || "_____________________________________________________", 48, 70);
    doc.line(48, 71, 185, 71);

    doc.setFont("helvetica", "bold");
    doc.text("Dirección:", 25, 80);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(reportData.direccion || "_____________________________________________________", 135);
    // Limit to 2 lines to avoid overlapping with the next field
    const displayAddress = addressLines.slice(0, 2);
    doc.text(displayAddress, 48, 80);
    doc.line(48, 86, 185, 86);

    doc.setFont("helvetica", "bold");
    doc.text("Distancia recorrida:", 25, 90);
    doc.setFont("helvetica", "normal");
    const distText = route.distanceKm > 0 ? `${route.distanceKm.toFixed(1)} km` : "__________________________________________";
    doc.text(distText, 68, 90);
    doc.line(68, 91, 185, 91);

    // Table Section
    const tableTop = 110;
    doc.setFillColor(220, 220, 220);
    doc.rect(20, tableTop, 170, 20, 'F'); // Header row background
    doc.rect(20, tableTop, 170, 80); // Table border
    
    // Vertical lines
    doc.line(95, tableTop, 95, tableTop + 40); // Between Espacio and Modelo
    doc.line(145, tableTop, 145, tableTop + 40); // Between Modelo and Capacidad
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ESPACIO", 57.5, tableTop + 12, { align: 'center' });
    doc.text("MODELO Y TIPO", 120, tableTop + 8, { align: 'center' });
    doc.text("DE PALLET", 120, tableTop + 14, { align: 'center' });
    doc.text("CAPACIDAD", 170, tableTop + 12, { align: 'center' });

    // Data row 1
    doc.line(20, tableTop + 20, 190, tableTop + 20);
    doc.setFont("helvetica", "normal");
    doc.text(selectedContainer.name, 57.5, tableTop + 32, { align: 'center' });
    doc.text("Estándar", 120, tableTop + 32, { align: 'center' });
    doc.text(`${selectedContainer.maxWeight} kg`, 170, tableTop + 32, { align: 'center' });

    // Remaining rows
    const rowHeight = 15;
    let currentY = tableTop + 40;
    
    // Items Cargados
    doc.line(20, currentY, 190, currentY);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, currentY, 75, rowHeight, 'F');
    doc.rect(20, currentY, 170, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text("ITEMS CARGADOS", 57.5, currentY + 10, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`${placedItems.length}`, 145, currentY + 10, { align: 'center' });
    currentY += rowHeight;

    // Peso Cargado
    doc.line(20, currentY, 190, currentY);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, currentY, 75, rowHeight, 'F');
    doc.rect(20, currentY, 170, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text("PESO CARGADO", 57.5, currentY + 10, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`${metrics.placedWeight.toLocaleString()} kg`, 145, currentY + 10, { align: 'center' });
    currentY += rowHeight;

    // Espacio Ocupado
    doc.line(20, currentY, 190, currentY);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, currentY, 75, rowHeight, 'F');
    doc.rect(20, currentY, 170, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text("ESPACIO OCUPADO", 57.5, currentY + 10, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`${metrics.utilization.toFixed(1)}%`, 145, currentY + 10, { align: 'center' });
    currentY += rowHeight;

    doc.line(20, currentY, 190, currentY);
    doc.setFillColor(232, 248, 240);
    doc.rect(20, currentY, 75, rowHeight, 'F');
    doc.rect(20, currentY, 170, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text("ALGORITMO", 57.5, currentY + 10, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text("EP-BFD", 145, currentY + 10, { align: 'center' });
    currentY += rowHeight;

    doc.line(20, currentY, 190, currentY);
    doc.setFillColor(232, 248, 240);
    doc.rect(20, currentY, 75, rowHeight, 'F');
    doc.rect(20, currentY, 170, rowHeight);
    doc.setFont("helvetica", "bold");
    doc.text("DIESEL EVITADO", 57.5, currentY + 10, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`${metrics.fuelAvoided.toFixed(1)} L`, 145, currentY + 10, { align: 'center' });
    currentY += rowHeight;

    // Notes Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("NOTAS DEL PEDIDO:", 20, currentY + 10);
    doc.setFillColor(230, 230, 230);
    doc.rect(20, currentY + 15, 170, 30, 'F');
    doc.rect(20, currentY + 15, 170, 30);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.notas, 25, currentY + 25, { maxWidth: 160 });

    // Payment Section
    const paymentY = currentY + 55;
    doc.setFont("helvetica", "bold");
    doc.text("FORMA DE PAGO", 50, paymentY, { align: 'center' });
    doc.setFontSize(10);
    
    doc.text("Efectivo", 30, paymentY + 15);
    doc.rect(65, paymentY + 10, 45, 8);
    if (reportData.formaPago === 'Efectivo') doc.text("X", 87.5, paymentY + 16, { align: 'center' });
    
    doc.text("Tarjeta", 30, paymentY + 25);
    doc.rect(65, paymentY + 20, 45, 8);
    if (reportData.formaPago === 'Tarjeta') doc.text("X", 87.5, paymentY + 26, { align: 'center' });
    
    doc.text("Transferencia", 30, paymentY + 35);
    doc.rect(65, paymentY + 30, 45, 8);
    if (reportData.formaPago === 'Transferencia') doc.text("X", 87.5, paymentY + 36, { align: 'center' });

    doc.setFontSize(12);
    doc.text("ABONO", 150, paymentY, { align: 'center' });
    doc.rect(125, paymentY + 5, 50, 10);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.abono, 150, paymentY + 12, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.text("VALOR PENDIENTE", 150, paymentY + 25, { align: 'center' });
    doc.rect(125, paymentY + 30, 50, 10);
    doc.setFont("helvetica", "normal");
    doc.text(reportData.valorPendiente, 150, paymentY + 37, { align: 'center' });

    doc.save(`Reporte_Carga_${Date.now()}.pdf`);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-emerald-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
          <Loader2 className="w-5 h-5 animate-spin" />
          Validando sesion
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} onSignup={handleSignup} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#dfe8df] text-gray-700 select-none overflow-hidden">
      <PwaInstallButton />
      {showSetup && (
        <InitialSetup 
          brand={APP_BRAND}
          onConfirm={(c) => { 
            const found = containerList.find(x => x.type === c.type);
            setSelectedContainer(found || containerList[1]); 
            setPlacedItems([]);
            localStorage.setItem('cargo_setup_done', 'true');
            setShowSetup(false); 
          }} 
        />
      )}
      
      {showTicket && (
        <MerchandiseTicket 
          setShowTicket={setShowTicket}
          reportData={reportData}
          setReportData={setReportData}
          selectedContainer={selectedContainer}
          metrics={metrics}
          items={items}
          placedItems={placedItems}
          exportToPdf={exportToPdf}
        />
      )}
      
      {showRouteSelector && (
        <RouteSelector 
          route={route} 
          onUpdate={setRoute} 
          onClose={() => setShowRouteSelector(false)} 
        />
      )}
      
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-[500px] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-500" /> Exportar Carga</h3>
                <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4" /></button>
             </div>
             <div className="p-6 space-y-4">
                <button onClick={() => { setShowTicket(true); setShowShareModal(false); }} className="w-full flex items-center justify-center gap-3 p-4 border border-emerald-300 bg-emerald-50/70 rounded-xl hover:bg-emerald-100 transition-all text-emerald-800">
                    <ClipboardList className="w-6 h-6" /> <span className="font-black uppercase tracking-tight italic">Ver Manifiesto Sustentable</span>
                </button>
                <button onClick={exportToPdf} className="w-full flex items-center justify-center gap-3 p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-all text-red-600">
                    <FileText className="w-6 h-6" /> <span className="font-bold uppercase tracking-tight">Descargar Reporte PDF</span>
                </button>
                <button onClick={() => { const data = JSON.stringify({ container: selectedContainer, items, placed: placedItems }); const blob = new Blob([data], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'export_easycargo.json'; a.click(); }} className="w-full flex items-center justify-center gap-3 p-4 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all text-blue-600">
                    <FileJson className="w-6 h-6" /> <span className="font-bold uppercase tracking-tight">Exportar JSON</span>
                </button>
             </div>
          </div>
        </div>
      )}

      {showAiPanel && (
        <div className={`fixed right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-[120] flex flex-col transition-transform duration-500 transform ${showAiPanel ? 'translate-x-0' : 'translate-x-full border-l border-gray-200'}`}>
          <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black italic uppercase tracking-tighter text-lg">Asistente <span className="text-blue-400">Logístico</span></h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Optimización impulsada por IA</p>
              </div>
            </div>
            <button onClick={() => setShowAiPanel(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 p-8 overflow-y-auto bg-gray-50 space-y-8">
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="font-black text-gray-400 uppercase tracking-widest text-xs italic">Analizando distribución de peso y espacio...</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-2 mb-6 text-blue-600">
                  <Info className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Análisis de Configuración Actual</span>
                </div>
                <div className="prose prose-sm prose-slate max-w-none">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm leading-relaxed text-gray-600 font-medium whitespace-pre-line">
                    {aiAdvice || "No hay análisis disponible. Presione el botón de cargar para actualizar la simulación."}
                  </div>
                </div>
                <div className="mt-8 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 italic text-[11px] text-emerald-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>Este análisis es generado por IA para fines de entrenamiento. Verifique siempre con normativas locales de transporte.</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t bg-white">
            <button onClick={requestAiAdvice} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              <RefreshCw className={`w-5 h-5 ${isAiLoading ? 'animate-spin' : ''}`} />
              Actualizar Análisis IA
            </button>
          </div>
        </div>
      )}

      <header className="h-11 bg-emerald-950 border-b border-emerald-800 flex items-center px-0 z-30 shadow-sm">
        <div className="h-full px-3 flex items-center gap-2 border-r border-emerald-800 bg-emerald-950">
          <img src={APP_LOGO} alt={`${APP_BRAND} logo`} className="w-7 h-7 rounded-lg object-cover border border-emerald-500/40" />
        </div>
        <div className="flex h-full">
          {[
            { id: 'simulador', label: APP_BRAND },
            { id: 'cargas', label: 'Impacto y Reportes' },
            { id: 'items', label: 'Ítems para la carga' },
            { id: 'espacio', label: 'Espacio de carga' },
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'licencias', label: 'Licencias' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveView(tab.id as ViewType)} 
              className={`px-4 h-full text-[11px] font-bold border-r border-emerald-800 transition-all relative ${activeView === tab.id ? 'bg-emerald-900 text-white' : 'text-emerald-100 hover:bg-emerald-900/70'}`}
            >
              {tab.label}
              {activeView === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-500"></div>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-4">
          <button onClick={() => setShowSetup(true)} className="p-1 hover:bg-emerald-800 rounded text-emerald-100" title="Configuracion inicial"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={requestAiAdvice} className="p-1 hover:bg-emerald-800 rounded text-emerald-100" title="Ayuda sustentable"><HelpCircle className="w-4 h-4" /></button>
          <div className="h-4 w-[1px] bg-emerald-800 mx-1"></div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-emerald-700 rounded text-[10px] font-bold text-emerald-50">
             <User className="w-3 h-3" /> {CURRENT_USER.name} <span className="text-gray-400">{CURRENT_USER.email}</span>
          </div>
          <button onClick={() => setActiveView('licencias')} className="bg-emerald-500 text-white px-4 py-1.5 rounded text-[11px] font-black uppercase hover:bg-emerald-600 shadow-sm flex items-center gap-2">
            Plan verde
          </button>
          <button onClick={handleLogout} className="text-[11px] font-bold text-gray-400 hover:text-red-500 px-2 flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {activeView === 'simulador' ? (
          <>
            {showSidebar && <aside className="w-[min(420px,45vw)] bg-[#eef4ef] border-r border-emerald-200 flex flex-col z-20 shadow-lg overflow-hidden">
              <div className="p-3 border-b bg-emerald-100 flex items-center gap-2">
                <Menu className="w-4 h-4 text-gray-500" />
                <input placeholder="Introducir nombre de carga" className="bg-transparent text-xs w-full outline-none italic font-bold text-gray-600" />
              </div>
              
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b bg-white flex items-center gap-2">
                   <div className="bg-emerald-600 text-white w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold">1</div>
                   <button onClick={() => {
                     const newItem = { id: Date.now().toString(), name: 'Nuevo Item', length: 50, width: 50, height: 50, weight: 10, quantity: 1, color: '#'+Math.floor(Math.random()*16777215).toString(16), stackable: true, tiltable: true };
                     updateItemsWithCapacityCheck([...items, newItem]);
                   }} 
                   className="p-1 border border-gray-300 rounded hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                
                <div className="bg-emerald-50 p-1.5 px-3 border-b border-emerald-100 flex justify-between items-center">
                   <span className="text-[10px] font-black text-emerald-800 uppercase tracking-tighter">Grupo de Carga Sustentable 1</span>
                   <button className="text-[9px] text-gray-400 italic hover:text-gray-600">- editar nota</button>
                </div>
                
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white">
                  {items.map(item => (
                    <ItemEditor 
                      key={item.id} 
                      item={item} 
                      onUpdate={(f, v) => {
                        const newItems = items.map(i => i.id === item.id ? { ...i, [f]: v } : i);
                        updateItemsWithCapacityCheck(newItems);
                      }} 
                      onRemove={() => setItems(items.filter(i => i.id !== item.id))} 
                    />
                  ))}
                  <div className="p-12 text-center text-gray-300 flex flex-col items-center gap-2">
                     <PlusSquare className="w-8 h-8 opacity-20" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Agregar nuevo ítem</span>
                  </div>
                </div>
              </div>
            </aside>}

            <main className="flex-1 relative bg-[#bebebe]">
              <div className="absolute inset-0">
                <Container3D 
                  key={`${selectedContainer.id}-${placedItems.length}`}
                  container={selectedContainer} 
                  placedItems={placedItems} 
                  showWeightHeatmap={showWeightHeatmap} 
                  cameraView={cameraView}
                />
              </div>

              <div className="absolute z-30 right-3 bottom-24 sm:right-6 sm:bottom-6 w-[min(360px,calc(100vw-24px))] bg-emerald-950/92 text-white rounded-2xl shadow-2xl border border-emerald-400/30 backdrop-blur-md overflow-hidden">
                <button
                  onClick={() => setShowSustainabilityDrawer(!showSustainabilityDrawer)}
                  className="w-full flex items-center justify-between gap-2 p-4 select-none hover:bg-white/5 transition-colors"
                  title="Mostrar informacion sustentable"
                >
                  <div className="flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Carga sustentable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-300">{APP_BADGE}</span>
                    <ChevronRight className={`w-4 h-4 text-emerald-300 transition-transform ${showSustainabilityDrawer ? '-rotate-90' : 'rotate-90'}`} />
                  </div>
                </button>
                <div className={`transition-all duration-300 overflow-hidden ${showSustainabilityDrawer ? 'max-h-[340px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-2xl font-black">{metrics.tripsAvoided}</div>
                        <div className="text-[9px] uppercase tracking-widest text-emerald-200">viajes evitados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black">{metrics.fuelAvoided.toFixed(1)}</div>
                        <div className="text-[9px] uppercase tracking-widest text-emerald-200">L diesel</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black">{metrics.sustainability.co2Avoided.toFixed(1)}</div>
                        <div className="text-[9px] uppercase tracking-widest text-emerald-200">kg CO2</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-white/10 border border-emerald-400/20 px-3 py-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-emerald-200">Algoritmo de cubicaje</div>
                      <div className="text-xs font-black text-white">EP-BFD: Extreme Point Best-Fit Decreasing</div>
                    </div>
                    <div className="mt-3 border-t border-emerald-700/60 pt-3 grid grid-cols-2 gap-3 text-[10px] text-emerald-100">
                      <div>
                        <span className="block font-black text-white">{metrics.requiredTrips}</span>
                        <span className="uppercase tracking-widest">viajes requeridos</span>
                      </div>
                      <div>
                        <span className="block font-black text-white">{metrics.overflowFuelRequired.toFixed(1)} L</span>
                        <span className="uppercase tracking-widest">diesel viaje sobrante</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Control Dock */}
              <div className="absolute z-30 left-3 right-3 bottom-3 flex flex-col-reverse sm:flex-row items-center justify-center gap-2 sm:gap-3 pointer-events-none">
                <div
                  className={`pointer-events-auto transition-all duration-500 ease-in-out ${showCapacitySummary ? 'w-[min(400px,calc(100vw-24px))]' : 'w-[min(260px,calc(100vw-24px))]'}`}
                >
                  <div className="bg-white/95 backdrop-blur-md border border-white shadow-2xl rounded-2xl overflow-hidden">
                  {/* Header / Toggle Button */}
                  <div className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="p-1 -ml-1 text-gray-300">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${metrics.totalInventoryWeight > selectedContainer.maxWeight ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black text-gray-800 uppercase tracking-tighter">Resumen de Capacidad</span>
                    </div>
                    <button
                      onClick={() => setShowCapacitySummary(!showCapacitySummary)}
                      className="flex items-center gap-2"
                      title="Abrir resumen"
                    >
                      {!showCapacitySummary && (
                        <div className="flex items-center gap-2 mr-2">
                          <span className={`text-[10px] font-bold ${metrics.totalInventoryWeight > selectedContainer.maxWeight ? 'text-red-500' : 'text-emerald-600'}`}>
                            {Math.round((metrics.totalInventoryWeight / selectedContainer.maxWeight) * 100)}%
                          </span>
                        </div>
                      )}
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showCapacitySummary ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                  </div>

                  {/* Expandable Content */}
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showCapacitySummary ? 'max-h-[520px] opacity-100 p-4 pt-0' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-4 mt-2">
                      {capacityError && (
                        <div className="bg-red-100 border border-red-200 p-2 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span className="text-[10px] font-bold text-red-800 leading-tight">{capacityError}</span>
                        </div>
                      )}

                      {overflowRecommendation && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                Sobrante detectado
                              </div>
                              <p className="text-[10px] font-bold text-amber-900 leading-snug">
                                {packingResult.unplacedCount} cajas fuera del limite ({packingResult.unplacedWeight.toLocaleString()} kg / {packingResult.unplacedVolume.toFixed(2)} m3).
                              </p>
                              <p className="text-[9px] font-bold text-amber-800 leading-snug mt-1">
                                Viaje sobrante estimado: {metrics.overflowFuelRequired.toFixed(1)} L diesel / {metrics.overflowCo2Required.toFixed(1)} kg CO2. Viajes requeridos: {metrics.requiredTrips}.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                {overflowRecommendation.status === 'fits' ? 'Unidad menor recomendada' : 'Mejor unidad parcial'}
                              </div>
                              <div className="text-[11px] font-black text-gray-800 truncate">{overflowRecommendation.container.name}</div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedContainer(overflowRecommendation.container);
                                setPlacedItems([]);
                              }}
                              className="shrink-0 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-800 transition-colors"
                            >
                              Usar
                            </button>
                          </div>
                          {overflowRecommendation.status === 'partial' && (
                            <p className="text-[9px] font-bold text-amber-800 leading-snug">
                              Esta unidad carga {overflowRecommendation.placedCount}; aun quedarian {overflowRecommendation.unplacedCount}. Conviene dividir el sobrante en mas viajes.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Barra de Peso */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-500 uppercase">Peso Total:</span>
                          <span className={`${metrics.totalInventoryWeight > selectedContainer.maxWeight ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
                            {metrics.totalInventoryWeight.toLocaleString()} / {selectedContainer.maxWeight.toLocaleString()} kg
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
                          <div 
                            className={`h-full transition-all duration-500 ${metrics.totalInventoryWeight > selectedContainer.maxWeight ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (metrics.totalInventoryWeight / selectedContainer.maxWeight) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Barra de Volumen */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-500 uppercase">Volumen Total:</span>
                          <span className="text-gray-800">
                            {metrics.placedVol.toFixed(2)} / {metrics.containerVol.toFixed(2)} m³
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (metrics.placedVol / metrics.containerVol) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-gray-50 border border-gray-100 p-2.5 flex justify-between items-center rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Items</span>
                            <span className="font-black text-gray-800">{items.reduce((acc, i) => acc + i.quantity, 0)}</span>
                          </div>
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="bg-gray-50 border border-gray-100 p-2.5 flex justify-between items-center rounded-xl">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sin Espacio</span>
                            <span className={`font-black ${metrics.unplacedCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{metrics.unplacedCount}</span>
                          </div>
                          <AlertCircle className={`w-4 h-4 ${metrics.unplacedCount > 0 ? 'text-orange-300' : 'text-gray-200'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md shadow-2xl p-1.5 rounded-2xl border border-white">
                  {[
                    { type: 'truck' as Container['type'], label: 'Camion', icon: Truck },
                    { type: 'pallet' as Container['type'], label: 'Pallet', icon: Package },
                    { type: 'container' as Container['type'], label: 'Contenedor', icon: Box },
                  ].map(({ type, label, icon: Icon }) => {
                    const isActive = selectedContainer.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => selectFirstContainerByType(type)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
                          isActive
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                            : 'bg-white text-gray-500 border-gray-100 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                        title={`Seleccionar ${label}`}
                        aria-label={`Seleccionar ${label}`}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-3">
                {/* 1. Métricas de Carga */}
                <div className="relative">
                  <button 
                    onClick={() => setShowMetrics(!showMetrics)} 
                    className={`p-3 rounded-full transition-all shadow-xl border ${showMetrics ? 'bg-gray-800 text-white border-gray-900' : 'bg-white/90 text-gray-500 border-white hover:bg-gray-100'}`}
                    title="Métricas de Carga"
                  >
                    {showMetrics ? <X className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
                  </button>

                  {showMetrics && (
                    <div className="absolute top-0 left-16 w-64 bg-white/95 backdrop-blur-md border border-white shadow-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="flex justify-between items-center mb-4">
                         <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">ACTIVO</div>
                         <div className="text-[11px] font-black text-gray-800 uppercase tracking-tighter">{selectedContainer.name}</div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-gray-500 uppercase tracking-tighter">PESO CARGADO:</span>
                            <span className="text-emerald-600">{metrics.placedWeight.toLocaleString()} kg</span>
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-gray-500 uppercase tracking-tighter">VOLUMEN OCUPADO:</span>
                            <span className="text-gray-800">{metrics.placedVol.toFixed(2)} m³</span>
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold border-t border-gray-200 pt-2 mt-2">
                            <span className="text-gray-500 uppercase tracking-tighter">CUBICAJE REAL:</span>
                            <span className="text-gray-900 font-black">{metrics.utilization.toFixed(1)}%</span>
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold text-red-500">
                            <span className="text-gray-400 uppercase tracking-tighter">ESPACIO LIBRE:</span>
                            <span className="font-black">{(metrics.containerVol - metrics.placedVol).toFixed(2)} m³</span>
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-bold border-t border-gray-200 pt-2 mt-2">
                            <span className="text-gray-500 uppercase tracking-tighter">ESTABILIDAD (CoG):</span>
                            <span className={`font-black ${metrics.stabilityIndex > 70 ? 'text-emerald-600' : 'text-orange-500'}`}>
                               {metrics.stabilityIndex.toFixed(0)}%
                            </span>
                         </div>

                          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl relative overflow-hidden">
                            <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl shadow-lg italic">
                               RATING {metrics.sustainability.rating}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                               <Leaf className="w-4 h-4 text-emerald-600" />
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Impacto Sustentable</span>
                            </div>
                            <div className="space-y-2">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Índice LCEI:</span>
                                  <span className="text-sm font-black text-emerald-700">{metrics.sustainability.lcei.toFixed(0)}%</span>
                               </div>
                               <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-emerald-600 h-full transition-all duration-1000" style={{ width: `${metrics.sustainability.lcei}%` }}></div>
                               </div>
                               <div className="flex justify-between items-center pt-1">
                                   <span className="text-[10px] font-bold text-emerald-600 uppercase">Viajes evitados:</span>
                                   <span className="text-[11px] font-black text-emerald-700">{metrics.tripsAvoided}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                   <span className="text-[10px] font-bold text-emerald-600 uppercase">CO2 evitado:</span>
                                   <span className="text-[11px] font-black text-emerald-700">{metrics.sustainability.co2Avoided.toFixed(1)} kg</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-emerald-100 mt-1">
                                   <span className="text-[10px] font-bold text-emerald-600 uppercase">Diesel evitado:</span>
                                   <span className="text-[11px] font-black text-emerald-700">{metrics.fuelAvoided.toFixed(1)} L</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                   <span className="text-[10px] font-bold text-emerald-600 uppercase">Consumo viaje:</span>
                                   <span className="text-[11px] font-black text-emerald-700">{metrics.fuelConsumption.toFixed(1)} L</span>
                                </div>
                            </div>
                         </div>

                         <div className="mt-4 grid grid-cols-1 gap-2">
                            <button 
                              onClick={() => setShowRouteSelector(true)}
                              className="w-full p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between hover:bg-blue-50 transition-all group"
                            >
                               <div className="flex items-center gap-2">
                                  <Navigation className="w-4 h-4 text-blue-500" />
                                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Ruta de Envío</span>
                               </div>
                               <div className="text-[11px] font-black text-blue-600">
                                  {route.distanceKm > 0 ? `${route.distanceKm.toFixed(0)} km` : 'Configurar'}
                               </div>
                            </button>
                         </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Herramientas */}
                <div className="relative flex items-center gap-2">
                  <button 
                    onClick={() => setShowUtils(!showUtils)} 
                    className={`p-3 rounded-full transition-all shadow-xl border ${showUtils ? 'bg-gray-800 text-white border-gray-900' : 'bg-white/90 text-gray-500 border-white hover:bg-gray-100'}`} 
                    title="Herramientas"
                  >
                    {showUtils ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                  </button>
                  
                  {showUtils && (
                    <>
                      <div className="bg-white/90 rounded-full shadow-lg p-1.5 flex gap-2 border border-white animate-in fade-in slide-in-from-left-2 duration-200">
                        <button
                          onClick={() => setCameraView(cameraView === 'front' ? 'iso' : 'front')}
                          className={`p-2.5 hover:bg-gray-100 rounded-full transition-colors ${cameraView === 'front' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}
                          title="Camara Frontal"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowSidebar(!showSidebar)}
                          className={`p-2.5 hover:bg-gray-100 rounded-full transition-colors ${!showSidebar ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}
                          title="Maximizar"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button onClick={requestAiAdvice} className="p-2.5 hover:bg-blue-50 rounded-full text-blue-600 transition-colors" title="Asistente AI"><Sparkles className="w-4 h-4" /></button>
                      </div>

                      <div className="absolute top-14 left-0 z-50 w-72 bg-white/95 backdrop-blur-md border border-white shadow-2xl rounded-2xl p-4 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">Caja del camion</div>
                            <div className="text-[11px] font-black text-gray-800 truncate">{selectedContainer.name}</div>
                          </div>
                          <Truck className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['length', 'Largo cm'],
                            ['width', 'Ancho cm'],
                            ['height', 'Alto cm'],
                            ['maxWeight', 'Peso kg'],
                          ].map(([field, label]) => (
                            <label key={field} className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                              {label}
                              <input
                                type="number"
                                min="1"
                                value={selectedContainer[field as keyof Pick<Container, 'length' | 'width' | 'height' | 'maxWeight'>]}
                                onChange={(event) => updateSelectedContainer(field as keyof Pick<Container, 'length' | 'width' | 'height' | 'maxWeight'>, Number(event.target.value))}
                                className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-700 outline-none focus:border-emerald-500"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. Más opciones (+) */}
                <div className="relative flex items-center gap-2">
                  <button 
                    onClick={() => setShowBottomUtils(!showBottomUtils)} 
                    className={`p-3 rounded-full transition-all shadow-xl border ${showBottomUtils ? 'bg-gray-800 text-white border-gray-900' : 'bg-white text-gray-500 border-white hover:bg-gray-100'}`}
                    title="Más opciones"
                  >
                    {showBottomUtils ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>

                  {showBottomUtils && (
                    <div className="flex gap-2 p-1.5 bg-white/30 backdrop-blur-sm rounded-full border border-white/40 shadow-xl animate-in fade-in slide-in-from-left-2 duration-200">
                      <button onClick={() => setShowTicket(true)} className="p-2.5 bg-white rounded-full shadow text-gray-500 hover:bg-gray-100" title="Ver manifiesto"><Video className="w-4 h-4" /></button>
                      <button onClick={() => setShowWeightHeatmap(!showWeightHeatmap)} className={`p-2.5 rounded-full shadow border transition-all ${showWeightHeatmap ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-gray-500 hover:bg-gray-100'}`} title="Mapa de Calor"><Weight className="w-4 h-4" /></button>
                      <button onClick={() => setShowShareModal(true)} className="p-2.5 bg-white rounded-full shadow text-gray-500 hover:bg-gray-100" title="Compartir"><Share2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {/* 4. Cargar y generar reporte */}
                <div className="relative flex items-center gap-2">
                  <button 
                    onClick={handlePackAndReport} 
                    className="w-12 h-12 rounded-full bg-white border-[3px] border-[#f0f0f0] shadow-xl flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                    title="Ejecutar carga y generar manifiesto"
                  >
                    <span className="z-10 text-[10px] font-black text-gray-800 uppercase tracking-tighter">Cargar</span>
                    <div className="w-4 h-[1.5px] bg-emerald-500 mt-0.5 rounded-full group-hover:w-6 transition-all"></div>
                  </button>
                </div>
              </div>

            </main>
          </>
        ) : (
          <div className="flex-1 bg-[#f3f3f3] overflow-hidden flex flex-col">
            {activeView === 'cargas' && (
              <div className="flex flex-col h-full">
                <div className="bg-white border-b border-gray-300 p-2 flex items-center gap-2 shadow-sm">
                   {[
                     { label: 'NOMBRE DE CARGA', width: '30%' },
                     { label: 'ESPACIO DE CARGA', width: '20%' },
                     { label: 'VERSIÓN', width: '10%' },
                     { label: 'CREADO', width: '20%' },
                     { label: 'USUARIO', width: '20%' }
                   ].map(h => (
                     <div key={h.label} style={{ width: h.width }} className="p-2 bg-[#f8f9fa] border border-gray-200 rounded">
                        <div className="text-[9px] font-black text-gray-400 mb-1">{h.label}</div>
                        <div className="flex items-center justify-between">
                           <input className="w-full text-[11px] outline-none bg-transparent font-medium" placeholder="Filtrar..." />
                           <Filter className="w-3 h-3 text-gray-300" />
                        </div>
                     </div>
                   ))}
                </div>
                <div className="flex-1 bg-white overflow-y-auto">
                   <table className="w-full text-[12px] text-left border-collapse">
                      <thead className="bg-[#f8f9fa] border-b border-gray-300 sticky top-0 z-10">
                         <tr>
                            <th className="p-4 border-r border-gray-200 font-bold text-gray-700">Nombre de carga</th>
                            <th className="p-4 border-r border-gray-200 font-bold text-gray-700">Espacio</th>
                            <th className="p-4 border-r border-gray-200 font-bold text-gray-700">Versión</th>
                            <th className="p-4 border-r border-gray-200 font-bold text-gray-700">Creado</th>
                            <th className="p-4 font-bold text-gray-700">Usuario</th>
                            <th className="p-4">Acciones</th>
                         </tr>
                      </thead>
                      <tbody>
                        {cargasHistory.map(h => (
                          <tr key={h.id} className="border-b border-gray-100 hover:bg-[#ebf4ff] cursor-pointer group transition-colors">
                            <td className="p-4 border-r border-gray-100 text-blue-600 font-bold">{h.nombre}</td>
                            <td className="p-4 border-r border-gray-100 text-gray-600">{h.espacio}</td>
                            <td className="p-4 border-r border-gray-100 text-gray-600">{h.version}</td>
                            <td className="p-4 border-r border-gray-100 text-gray-600">{h.creado}</td>
                            <td className="p-4 text-gray-600 border-r border-gray-100">{h.usuario}</td>
                            <td className="p-4">
                               <button onClick={() => setShowTicket(true)} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors">
                                  <ClipboardList className="w-3.5 h-3.5" /> Ticket
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}
            
            {activeView === 'items' && (
              <div className="flex flex-col h-full bg-white">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                         <input 
                           type="text" 
                           placeholder="Buscar ítems..." 
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-yellow-400 w-64 shadow-inner"
                         />
                      </div>
                      
                      <div className="flex items-center gap-2 border-l-2 border-gray-200 pl-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ordenar por:</span>
                        <select 
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="bg-white border border-gray-200 rounded-lg text-[11px] font-bold px-3 py-2 outline-none focus:border-blue-400 shadow-sm text-gray-700"
                        >
                          <option value="name">Nombre</option>
                          <option value="weight">Peso</option>
                          <option value="volume">Volumen</option>
                        </select>
                        
                      </div>

                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-l-2 border-gray-200 pl-4">
                         Total: {items.length} ítems registrados
                      </div>
                   </div>
                   <button onClick={() => { setActiveView('simulador'); }} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Nuevo ítem
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                   <table className="w-full text-left text-xs">
                      <thead className="bg-[#f8f9fa] border-b border-gray-200 sticky top-0">
                         <tr>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter">Descripción</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">LO (cm)</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">AN (cm)</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-center">AL (cm)</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter text-right">Peso (kg)</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter">Restricciones</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter">Creado</th>
                            <th className="p-4 font-black text-gray-400 uppercase tracking-tighter">Usuario</th>
                            <th className="p-4"></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {[...items]
                           .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                           .sort((a, b) => {
                             let comparison = 0;
                             if (sortBy === 'name') {
                               comparison = a.name.localeCompare(b.name);
                             } else if (sortBy === 'weight') {
                               comparison = a.weight - b.weight;
                             } else if (sortBy === 'volume') {
                               const volA = a.length * a.width * a.height;
                               const volB = b.length * b.width * b.height;
                               comparison = volA - volB;
                             }
                             return comparison;
                           })
                           .map((i, index) => (
                             <tr key={i.id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                               <td className="p-4 font-bold flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: i.color }}></div>
                                  {i.name}
                               </td>
                               <td className="p-4 font-mono font-medium text-gray-500 text-center">{i.length}</td>
                               <td className="p-4 font-mono font-medium text-gray-500 text-center">{i.width}</td>
                               <td className="p-4 font-mono font-medium text-gray-500 text-center">{i.height}</td>
                               <td className="p-4 font-mono font-bold text-gray-700 text-right">{i.weight}</td>
                               <td className="p-4">
                                  <div className="flex gap-1">
                                     <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${i.stackable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>Apilable</span>
                                     {i.tiltable && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase">Inclinable</span>}
                                  </div>
                               </td>
                               <td className="p-4 text-gray-400 italic">19/1/2026</td>
                                <td className="p-4 text-gray-400 font-medium">{CURRENT_USER.name}</td>
                               <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                     <button
                                       onClick={() => setActiveView('simulador')}
                                       className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-400 hover:text-blue-500"
                                       title="Editar en simulador"
                                     >
                                       <Edit className="w-3.5 h-3.5" />
                                     </button>
                                     <button
                                       onClick={() => updateItemsWithCapacityCheck(items.filter(item => item.id !== i.id))}
                                       className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-400 hover:text-red-500"
                                       title="Eliminar item"
                                     >
                                       <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}
            
            {activeView === 'espacio' && (
              <div className="flex h-full">
                <div className="flex-1 flex flex-col border-r border-gray-300 overflow-hidden">
                   <div className="bg-white border-b border-gray-300 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">FILTRAR POR CATEGORÍA</span>
                         <div className="flex bg-[#f0f0f0] p-1 rounded-lg border border-gray-200 shadow-inner">
                            {['Todo', 'Contenedores', 'Camiones', 'Palets', 'Plataformas'].map(f => (
                              <button 
                                key={f} 
                                onClick={() => setFilterType(f === 'Todo' ? 'all' : f === 'Contenedores' ? 'container' : f === 'Camiones' ? 'truck' : f === 'Palets' ? 'pallet' : 'platform')}
                                className={`px-4 py-1 text-[11px] font-bold rounded-md transition-all ${filterType === (f === 'Todo' ? 'all' : f === 'Contenedores' ? 'container' : f === 'Camiones' ? 'truck' : f === 'Palets' ? 'pallet' : 'platform') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                              >
                                {f}
                              </button>
                            ))}
                         </div>
                      </div>
                      <button onClick={() => setFilterType('all')} className="text-[11px] font-bold text-gray-400 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50">Restablecer filtros</button>
                   </div>
                   <div className="flex-1 overflow-y-auto bg-white p-4">
                      <table className="w-full text-[11px] text-left border border-gray-100 rounded-lg overflow-hidden">
                         <thead className="bg-[#f8f9fa] border-b border-gray-200">
                            <tr>
                               <th className="p-4 font-bold text-gray-400 uppercase">Nombre del Espacio</th>
                               <th className="p-4 font-bold text-gray-400 uppercase">Categoría</th>
                               <th className="p-4 font-bold text-gray-400 uppercase text-right">Largo (cm)</th>
                               <th className="p-4 font-bold text-gray-400 uppercase text-right">Ancho (cm)</th>
                               <th className="p-4 font-bold text-gray-400 uppercase text-right">Alto (cm)</th>
                               <th className="p-4 font-bold text-gray-400 uppercase text-right">Peso Máx (kg)</th>
                               <th className="p-4"></th>
                            </tr>
                         </thead>
                         <tbody>
                            {containerList.filter(c => filterType === 'all' || c.type === filterType).map(c => (
                              <tr key={c.id} onClick={() => { setSelectedContainer(c); setPlacedItems([]); setActiveView('simulador'); }} className="border-b border-gray-50 hover:bg-[#fff9e6] cursor-pointer group transition-colors">
                                 <td className="p-4 font-black text-blue-600 text-[12px]">{c.name}</td>
                                 <td className="p-4 text-gray-400 italic font-medium">{c.type}</td>
                                 <td className="p-4 text-right font-mono font-bold text-gray-600">{c.length}</td>
                                 <td className="p-4 text-right font-mono font-bold text-gray-600">{c.width}</td>
                                 <td className="p-4 text-right font-mono font-bold text-gray-600">{c.height}</td>
                                 <td className="p-4 text-right font-mono font-bold text-emerald-600">{c.maxWeight.toLocaleString()}</td>
                                 <td className="p-4 text-center">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        const nextContainers = containerList.filter(container => container.id !== c.id);
                                        setContainerList(nextContainers);
                                        if (selectedContainer.id === c.id) {
                                          setSelectedContainer(nextContainers[0] || CONTAINERS[0]);
                                          setPlacedItems([]);
                                        }
                                      }}
                                      className="p-1 rounded hover:bg-red-50"
                                      title="Eliminar espacio"
                                    >
                                      <Trash2 className="w-4 h-4 text-gray-200 group-hover:text-red-400 transition-colors" />
                                    </button>
                                 </td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
                
                <aside className="w-[380px] bg-[#e9ecef] p-6 flex flex-col gap-6 overflow-y-auto border-l border-gray-300">
                   <div className="bg-white border border-gray-300 rounded-xl shadow-lg p-6 space-y-6">
                      <h3 className="text-[12px] font-black uppercase text-gray-400 tracking-[0.2em] flex items-center gap-2">
                         <div className="w-6 h-[2px] bg-emerald-500"></div> CUBICAJE SUSTENTABLE
                      </h3>
                      
                      <div className="space-y-4">
                         <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nombre Descriptivo</label>
                            <input
                              value={customSpace.name}
                              onChange={(event) => setCustomSpace(prev => ({ ...prev, name: event.target.value }))}
                              className="w-full border border-gray-300 px-3 py-2 text-xs rounded focus:border-blue-500 outline-none shadow-inner"
                              placeholder="Ej: Mi camion custom"
                            />
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Longitud (cm)</label>
                               <input type="number" value={customSpace.length} onChange={(event) => setCustomSpace(prev => ({ ...prev, length: Number(event.target.value) }))} className="w-full border border-gray-300 px-3 py-2 text-xs rounded shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Anchura (cm)</label>
                               <input type="number" value={customSpace.width} onChange={(event) => setCustomSpace(prev => ({ ...prev, width: Number(event.target.value) }))} className="w-full border border-gray-300 px-3 py-2 text-xs rounded shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Altura (cm)</label>
                               <input type="number" value={customSpace.height} onChange={(event) => setCustomSpace(prev => ({ ...prev, height: Number(event.target.value) }))} className="w-full border border-gray-300 px-3 py-2 text-xs rounded shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Peso Máx (kg)</label>
                               <input type="number" value={customSpace.maxWeight} onChange={(event) => setCustomSpace(prev => ({ ...prev, maxWeight: Number(event.target.value) }))} className="w-full border border-gray-300 px-3 py-2 text-xs rounded shadow-inner" />
                            </div>
                         </div>
                         
                         <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Tipo de Cubículo</label>
                            <select
                              value={customSpace.type}
                              onChange={(event) => setCustomSpace(prev => ({ ...prev, type: event.target.value as Container['type'] }))}
                              className="w-full border border-gray-300 px-3 py-2 text-xs rounded bg-white shadow-inner"
                            >
                               <option value="container">Contenedor / Caja</option>
                               <option value="truck">Camion de carga</option>
                               <option value="trailer">Trailer</option>
                               <option value="platform">Plataforma</option>
                               <option value="pallet">Pallet estandar</option>
                            </select>
                         </div>
                         
                         <button onClick={addCustomSpace} className="w-full bg-blue-600 text-white py-3 rounded-lg font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                            <Plus className="w-4 h-4" /> Añadir espacio
                         </button>
                      </div>
                   </div>
                   
                   <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 italic">
                      <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                        <b>Nota:</b> Los espacios personalizados se guardan localmente en su navegador. Puede utilizarlos de inmediato en el simulador principal.
                      </p>
                   </div>
                </aside>
              </div>
            )}
            
            {activeView === 'usuarios' && (
              <div className="flex-1 bg-[#f0f0f2] p-8 overflow-y-auto">
                 <div className="max-w-5xl mx-auto space-y-8">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                       <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">— Mi Perfil —</span>
                       </div>
                       <div className="p-10 flex gap-12 items-start">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-32 h-32 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 relative group overflow-hidden">
                                <User className="w-16 h-16 text-gray-300" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold cursor-pointer uppercase">Cambiar foto</div>
                             </div>
                             <button className="text-[10px] font-bold text-blue-600 hover:underline uppercase">Cambiar foto</button>
                          </div>
                          
                          <div className="flex-1 grid grid-cols-2 gap-x-12 gap-y-8">
                             <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Nombre de Usuario</label>
                                 <input className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-700 bg-gray-50" defaultValue={CURRENT_USER.name} />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Email</label>
                                 <input className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-700 bg-gray-50" defaultValue={CURRENT_USER.email} />
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Rol / Nivel de Acceso</label>
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-lg">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                   <span className="text-xs font-black text-emerald-700 uppercase">Administrador de Empresa</span>
                                </div>
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Idioma Preferido</label>
                                <select className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-700 bg-white">
                                   <option>Español (Latinoamérica)</option>
                                   <option>English (US)</option>
                                </select>
                             </div>
                             <div className="col-span-2 flex justify-end mt-4">
                                <button className="bg-emerald-600 text-white px-10 py-3 rounded-lg font-black text-[12px] uppercase shadow-lg hover:bg-emerald-700 active:scale-95 transition-all">Guardar Cambios</button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {activeView === 'licencias' && (
              <div className="flex-1 bg-[#f0f2f5] p-8 overflow-y-auto">
                 <div className="max-w-6xl mx-auto space-y-8">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 flex items-center gap-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-12 bg-emerald-400/10 rounded-full translate-x-12 -translate-y-12"></div>
                       <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                          <CreditCard className="w-10 h-10 text-white" />
                       </div>
                       <div className="space-y-2 relative z-10">
                           <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Gestion de Suscripciones Verdes</h2>
                          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed">
                              Bienvenido al centro de licencias. Aqui podra gestionar el acceso de su equipo al simulador 3D, 
                              consultar reportes de impacto y solicitar capacidad adicional para proyectos de optimizacion sustentable. 
                              <span className="font-bold text-gray-900"> Su licencia actual es empresarial con foco en reduccion de CO2.</span>
                          </p>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
