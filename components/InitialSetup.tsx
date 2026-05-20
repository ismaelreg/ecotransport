
import React, { useState } from 'react';
import { Package, Truck, Box, Ship, Check, ArrowRight } from 'lucide-react';

interface InitialSetupProps {
  brand?: string;
  onConfirm: (choice: { type: string, units: string }) => void;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({ brand = 'EcoTransport', onConfirm }) => {
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [selectedType, setSelectedType] = useState<string>('container');
  
  const options = [
    { id: 'pallet', name: 'Palets', icon: <Package className="w-10 h-10" />, desc: 'Menos aire transportado' },
    { id: 'container', name: 'Contenedores', icon: <Ship className="w-10 h-10" />, desc: 'Transporte marítimo' },
    { id: 'truck', name: 'Camiones', icon: <Truck className="w-10 h-10" />, desc: 'Menos diesel por envio' },
    { id: 'trailer', name: 'Remolques', icon: <Box className="w-10 h-10" />, desc: 'Carga consolidada' }
  ];

  const handleConfirm = () => {
    // Aseguramos que se emita el evento hacia App.tsx
    onConfirm({ type: selectedType, units });
  };

  return (
    <div className="fixed inset-0 bg-emerald-950/85 z-[150] flex items-center justify-center backdrop-blur-md p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.5)] w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-12 duration-500">
        <div className="p-5 sm:p-8 border-b text-center relative bg-gray-50/80">
          <div className="static sm:absolute sm:top-8 sm:left-8 mb-2 sm:mb-0">
             <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Paso 1 de 1</div>
          </div>
          <h2 className="font-black text-gray-800 text-2xl sm:text-3xl tracking-tighter uppercase italic">Configuracion Inicial <span className="text-emerald-600">{brand}</span></h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Optimice espacio, combustible y emisiones desde el primer plan</p>
        </div>
        
        <div className="p-5 sm:p-10 space-y-8 sm:space-y-12 overflow-y-auto">
          {/* Section: Units */}
          <div className="space-y-6">
            <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-4">Sistema de Unidades</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 sm:pl-4">
              <label 
                className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${units === 'metric' ? 'bg-emerald-50 border-emerald-500 shadow-lg' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                onClick={() => setUnits('metric')}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${units === 'metric' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-200'}`}>
                  {units === 'metric' && <Check className="w-4 h-4 text-white font-black" />}
                </div>
                <div>
                  <div className="font-black text-gray-800 text-lg uppercase italic tracking-tighter">Sistema Métrico</div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">cm, m / kg, t</div>
                </div>
              </label>

              <label 
                className={`flex items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer ${units === 'imperial' ? 'bg-emerald-50 border-emerald-500 shadow-lg' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                onClick={() => setUnits('imperial')}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${units === 'imperial' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-200'}`}>
                  {units === 'imperial' && <Check className="w-4 h-4 text-white font-black" />}
                </div>
                <div>
                  <div className="font-black text-gray-800 text-lg uppercase italic tracking-tighter">Sistema Imperial</div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">in, ft / lb</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section: Default Space */}
          <div className="space-y-6">
            <h3 className="text-[12px] font-black text-gray-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-4">Espacio de Carga Predeterminado</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 sm:px-4">
              {options.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedType(item.id)}
                  onDoubleClick={handleConfirm}
                  className={`group min-h-36 sm:h-44 border-2 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all relative ${selectedType === item.id ? 'bg-white border-emerald-500 shadow-[0_20px_40px_rgba(16,185,129,0.16)] ring-4 ring-emerald-400/10' : 'bg-gray-50 border-gray-100 hover:border-gray-200 hover:bg-white'}`}
                >
                   {selectedType === item.id && (
                     <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-1 animate-in zoom-in">
                        <Check className="w-3 h-3 font-black" />
                     </div>
                   )}
                   <div className={`${selectedType === item.id ? 'text-emerald-600 scale-110' : 'text-gray-300 group-hover:text-gray-400'} transition-all duration-300`}>
                     {item.icon}
                   </div>
                   <div className="text-center">
                     <span className={`text-[12px] font-black uppercase tracking-widest block ${selectedType === item.id ? 'text-gray-900' : 'text-gray-400'}`}>
                        {item.name}
                     </span>
                     <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                       {item.desc}
                     </span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 bg-gray-50 border-t flex flex-col items-center gap-4 sm:gap-6">
          <p className="text-[10px] sm:text-[11px] text-gray-400 text-center sm:px-10 leading-relaxed max-w-2xl font-bold uppercase tracking-widest">
            Al confirmar, accederas al entorno de simulacion 3D para reducir viajes, aire transportado y consumo de combustibles fosiles.
          </p>
          <button 
            onClick={handleConfirm}
            className="group w-full sm:w-auto justify-center flex items-center gap-3 sm:gap-4 px-6 sm:px-16 py-4 sm:py-5 bg-emerald-700 text-white rounded-full text-xs sm:text-sm font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] hover:bg-emerald-800 hover:shadow-[0_20px_50px_rgba(6,95,70,0.25)] transition-all active:scale-95 shadow-xl"
          >
            Iniciar plan sustentable
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
