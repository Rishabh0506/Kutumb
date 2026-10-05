import React from 'react';

const Chip = ({ label, value, icon, color }) => {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium uppercase tracking-wider
      ${color || 'bg-white/5 border border-white/10 text-gray-300'}`}>
      {icon && <span>{icon}</span>}
      {label && <span className="text-gray-500 mr-0.5">{label}:</span>}
      {value}
    </span>
  );
};

export default Chip;
