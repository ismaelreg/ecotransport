
import React from 'react';
import { X } from 'lucide-react';

interface TooltipProps {
  text: string;
  subtext?: string;
  onClose: () => void;
  position: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, subtext, onClose, position, className = "" }) => {
  const arrowStyles = {
    left: "right-full top-1/2 -translate-y-1/2 border-y-8 border-y-transparent border-r-8 border-r-white",
    right: "left-full top-1/2 -translate-y-1/2 border-y-8 border-y-transparent border-l-8 border-l-white",
    top: "bottom-full left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-white",
    bottom: "top-full left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-white",
  };

  return (
    <div className={`absolute z-50 bg-white p-4 shadow-xl border border-gray-200 rounded-md w-64 ${className}`}>
      <div className={`absolute w-0 h-0 pointer-events-none ${arrowStyles[position]}`}></div>
      <button onClick={onClose} className="absolute top-1 right-1 text-gray-400 hover:text-gray-600">
        <X className="w-3 h-3" />
      </button>
      <p className="text-xs font-bold text-gray-700 leading-tight mb-2">{text}</p>
      {subtext && (
        <p className="text-[10px] text-gray-500 leading-tight">
          {subtext} <span className="text-blue-500 cursor-pointer hover:underline">haga clic aquí</span>
        </p>
      )}
      <button 
        onClick={onClose}
        className="mt-3 text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase"
      >
        De acuerdo, lo entiendo
      </button>
    </div>
  );
};
