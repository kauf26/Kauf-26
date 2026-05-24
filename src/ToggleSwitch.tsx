// src/components/ToggleSwitch.tsx
import React from 'react';


interface ToggleProps {
  isOn: boolean;
  onToggle: () => void;
}

export default function ToggleSwitch({ isOn, onToggle }: ToggleProps) {
  return (
    <div
      onClick={onToggle}
      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
        isOn ? "bg-emerald-600" : "bg-red-500"
      }`}
    >
   <div
     className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-300 ${
       isOn ? "translate-x-6" : "translate-x-0"
     }`}
   />
    </div>
  );
}