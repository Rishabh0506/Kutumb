import React from 'react';

/**
 * Shared modal shell: backdrop + centered card + accent bar.
 * Callers provide their own header/body/footer as children.
 *
 * Props:
 *   onClose       – called when the backdrop is clicked
 *   maxWidth      – tailwind max-w-* class (default 'max-w-md')
 *   accent        – 'rose' (default) | 'red' (destructive actions)
 *   center        – center-align inner content (default false)
 *   closeDisabled – ignore backdrop clicks (e.g. while an action is in flight)
 */
const Modal = ({ onClose, children, maxWidth = 'max-w-md', accent = 'rose', center = false, closeDisabled = false }) => {
  const isDestructive = accent === 'red';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => !closeDisabled && onClose && onClose()}
      />
      <div
        className={`relative bg-[#0f0f0f] border ${isDestructive ? 'border-red-500/30' : 'border-white/10'} rounded-3xl p-8 ${maxWidth} w-full shadow-2xl z-10 ${center ? 'text-center' : ''}`}
      >
        <div
          className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isDestructive ? 'via-red-500/80' : 'via-rose-500/60'} to-transparent rounded-t-3xl`}
        />
        {children}
      </div>
    </div>
  );
};

export default Modal;
