import React from 'react';

export const SendIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" className={className} fill="currentColor">
    <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
  </svg>
);

export const MicIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" className={className} fill="currentColor">
    <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm4.691-3.531c0 1.812-.943 3.429-2.354 4.295v1.942h2.235v1.442H7.426v-1.442h2.235v-1.942c-1.412-.867-2.354-2.483-2.354-4.295h-1.47c0 2.978 2.33 5.432 5.294 5.617v.771h2.336v-.771c2.964-.185 5.294-2.639 5.294-5.617h-1.47z"></path>
  </svg>
);

export const PlayIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" className={className} fill="currentColor">
    <path d="M8 5v14l11-7z"></path>
  </svg>
);

export const PauseIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" className={className} fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
  </svg>
);

export const DoubleCheckmarkIcon = ({ className = "w-4 h-4 text-blue-400" }: { className?: string }) => (
  <svg viewBox="0 0 16 11" width="16" height="11" className={className} fill="currentColor">
    <path d="M11.025.275 8.8 2.5l2.125 2.15 4.95-5.025.85.85-5.8 5.9-3.25-3.275.85-.85 2.4 2.425 4.1-4.15.875-.25zm-6.85 5.1-4 4.025.85.85 3.15-3.175 3.175 3.175.85-.85-3.175-3.175.85-.85z"></path>
    <path d="M10.15 5.625 11 6.475l-4.725 4.8L2.1 7.1l.85-.85 3.325 3.325 3.875-3.95z"></path>
  </svg>
);