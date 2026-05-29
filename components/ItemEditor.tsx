
import React from 'react';
/* Added missing Edit import */
import { Trash2, Package, Layers, Info, Plus, Minus, Edit } from 'lucide-react';
import { CargoItem } from '../types';

interface ItemEditorProps {
  item: CargoItem;
  onUpdate: (field: keyof CargoItem, value: any) => void;
  onRemove: () => void;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({ item, onUpdate, onRemove }) => {
  return (
    <div className="bg-white border-b border-gray-100 flex h-48 relative group hover:bg-[#fafafa] transition-colors">
      {/* Indicador lateral de color con sombreado */}
      <div className="w-2 h-full shadow-[inset_-2px_0_4px_rgba(0,0,0,0.1)]" style={{ backgroundColor: item.color }}></div>
      
      {/* Botón de borrado lateral */}
      <button onClick={onRemove} className="absolute left-[-15px] top-1/2 -translate-y-1/2 p-2 bg-white rounded-full border border-gray-200 shadow-lg opacity-0 group-hover:opacity-100 transition-all text-gray-400 hover:text-red-500 z-10 scale-75 group-hover:scale-100">
         <Trash2 className="w-4 h-4" />
      </button>

      <div className="flex-1 p-4 flex gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={true} readOnly className="w-4 h-4 rounded border-gray-300 accent-yellow-400 cursor-pointer" />
            <input 
              value={item.name}
              onChange={(e) => onUpdate('name', e.target.value)}
              className="flex-1 bg-gray-100/50 border border-transparent hover:border-gray-200 px-3 py-1.5 rounded text-[12px] font-black text-gray-700 outline-none focus:bg-white focus:border-blue-400 focus:shadow-sm transition-all uppercase tracking-tight"
            />
          </div>

          <div className="flex items-center gap-6 text-[11px] font-black text-gray-400">
            <div className="flex items-center gap-2">
              <span className="tracking-tighter uppercase">LO</span>
              <input type="number" value={item.length} onChange={(e) => onUpdate('length', +e.target.value)} className="w-12 border-b-2 border-gray-100 py-1 text-gray-800 text-center outline-none focus:border-yellow-400 transition-colors font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <span className="tracking-tighter uppercase">AN</span>
              <input type="number" value={item.width} onChange={(e) => onUpdate('width', +e.target.value)} className="w-12 border-b-2 border-gray-100 py-1 text-gray-800 text-center outline-none focus:border-yellow-400 transition-colors font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <span className="tracking-tighter uppercase">AL</span>
              <div className="flex items-baseline gap-1">
                <input type="number" value={item.height} onChange={(e) => onUpdate('height', +e.target.value)} className="w-12 border-b-2 border-gray-100 py-1 text-gray-800 text-center outline-none focus:border-yellow-400 transition-colors font-mono" />
                <span className="font-normal lowercase text-[9px] text-gray-300">cm</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                 <input type="number" value={item.weight} onChange={(e) => onUpdate('weight', +e.target.value)} className="w-16 border-b border-gray-200 text-[13px] font-black text-gray-800 outline-none bg-transparent" />
                 <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">kg / total <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded ml-1">piezas</span></span>
              </div>
            </div>
            
            <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-12">
               <div className="px-5 py-1 text-[13px] font-black text-gray-800 flex flex-col items-center justify-center min-w-[78px]">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => onUpdate('quantity', Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                    className="w-16 bg-transparent text-center text-[13px] font-black text-gray-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Cantidad de piezas"
                  />
                  <span className="text-[8px] uppercase text-gray-400 font-bold tracking-widest">PIEZAS</span>
               </div>
               <div className="flex flex-col border-l border-gray-100 h-full">
                  <button onClick={() => onUpdate('quantity', item.quantity + 1)} className="flex-1 px-4 hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition-colors border-b border-gray-50 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => onUpdate('quantity', Math.max(1, item.quantity - 1))} className="flex-1 px-4 hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
               </div>
            </div>
          </div>

          <div className="flex gap-4">
             <button onClick={() => onUpdate('stackable', !item.stackable)} className={`p-2 border rounded-lg transition-all flex items-center gap-2 group/btn ${item.stackable ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                <Layers className={`w-4 h-4 ${item.stackable ? 'text-yellow-600' : 'text-gray-300'}`} />
                <div className={`w-2 h-2 rounded-full ${item.stackable ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
             </button>
             <button onClick={() => onUpdate('tiltable', !item.tiltable)} className={`p-2 border rounded-lg transition-all flex items-center gap-2 group/btn ${item.tiltable ? 'bg-white border-gray-100' : 'bg-yellow-50 border-yellow-200 shadow-sm'}`}>
                <Info className={`w-4 h-4 ${item.tiltable ? 'text-gray-300' : 'text-yellow-600'}`} />
                <div className={`w-2 h-2 rounded-full ${!item.tiltable ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
             </button>
          </div>
        </div>

        {/* Visual Box Preview Exacto al Screenshot */}
        <div className="w-36 flex flex-col items-center justify-center">
           <div className="w-24 h-24 bg-gray-50 border border-gray-200 rounded-2xl relative flex items-center justify-center shadow-inner overflow-hidden group/box">
              <div 
                className="w-14 h-14 transform skew-x-12 -skew-y-6 rotate-3 relative flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover/box:rotate-12"
                style={{ 
                  backgroundColor: item.color + '33', 
                  border: `2px solid ${item.color}`,
                  boxShadow: `0 10px 30px ${item.color}22`
                }}
              >
                 <span className="text-4xl font-black text-gray-800 opacity-20 select-none italic">?</span>
                 <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent"></div>
              </div>
              <button className="absolute bottom-2 right-2 p-1.5 bg-white rounded-md shadow-md opacity-0 group-hover/box:opacity-100 transition-opacity">
                <Edit className="w-3 h-3 text-gray-400" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
