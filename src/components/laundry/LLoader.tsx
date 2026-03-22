import React from "react";

/**
 * ==========================================
 * LAUNDRYBOSS BRAND CONFIGURATION
 * ==========================================
 */
const BRAND = {
  teal: '#0D9488',   // Primary (Teal-600)
  amber: '#F59E0B',  // Secondary (Amber-500)
  bg: '#F8FAFC',     // Background
};

/**
 * ==========================================
 * CSS ANIMATION STYLES (Injected)
 * ==========================================
 */
const LOADER_STYLES = `
  /* 1. THE MACHINE: Front Loader */
  .lb-machine-drum {
    animation: lb-spin 2s linear infinite;
  }
  .lb-machine-water {
    animation: lb-wave 2s ease-in-out infinite alternate;
  }
  @keyframes lb-spin { 100% { transform: rotate(360deg); } }
  @keyframes lb-wave { 
    0% { transform: translateY(0); } 
    100% { transform: translateY(-5px); } 
  }

  /* 2. THE IRON: Iron Box */
  .lb-iron-body {
    animation: lb-iron-move 1.5s ease-in-out infinite alternate;
  }
  .lb-steam {
    animation: lb-steam-puff 1.5s infinite;
  }
  @keyframes lb-iron-move {
    0% { transform: translateX(-15px) rotate(-5deg); }
    100% { transform: translateX(15px) rotate(0deg); }
  }
  @keyframes lb-steam-puff {
    0% { opacity: 0; transform: translateY(0) scale(0.5); }
    50% { opacity: 0.8; }
    100% { opacity: 0; transform: translateY(-15px) scale(1.5); }
  }

  /* 3. THE HANGER: Finished Laundry */
  .lb-hanger-swing {
    animation: lb-hanger-sway 2.5s ease-in-out infinite;
    transform-origin: top center;
  }
  @keyframes lb-hanger-sway {
    0% { transform: rotate(10deg); }
    50% { transform: rotate(-10deg); }
    100% { transform: rotate(10deg); }
  }

  /* 4. THE CASH: Counting Money */
  .lb-cash-bill {
    animation: lb-count 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
  }
  @keyframes lb-count {
    0% { transform: translateY(0) scale(1); opacity: 1; z-index: 10; }
    20% { transform: translateY(-40%) scale(1.1); opacity: 1; z-index: 20; }
    50% { transform: translateY(-20%) scale(0.9); opacity: 0.5; z-index: 0; }
    100% { transform: translateY(0) scale(0.8); opacity: 0; z-index: -1; }
  }

  /* 5. THE BUBBLES: Processing */
  .lb-bubble {
    animation: lb-bubble-rise 1.5s infinite ease-in;
  }
  @keyframes lb-bubble-rise {
    0% { transform: translateY(20%) scale(0.4); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translateY(-120%) scale(1.1); opacity: 0; }
  }
`;

/**
 * ==========================================
 * TYPES & HELPERS
 * ==========================================
 */
export type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';
export type LoaderVariant = 'machine' | 'iron' | 'hanger' | 'cash' | 'bubbles';

interface BaseLoaderProps {
  size?: LoaderSize;
  className?: string;
}

const SIZE_MAP: Record<LoaderSize, number> = {
  sm: 24,
  md: 40,
  lg: 56,
  xl: 80,
};

/**
 * ==========================================
 * INDIVIDUAL VARIANTS
 * ==========================================
 */

// Variant 1: The Washing Machine
// Best for: "Washing In Progress"
const MachineLoader: React.FC<BaseLoaderProps> = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size];
  const border = Math.max(2, px * 0.05);
  
  return (
    <div className={`relative bg-white rounded-md border-2 border-slate-300 flex items-center justify-center overflow-hidden ${className}`} 
         style={{ width: px, height: px }}>
      {/* Control Panel */}
      <div className="absolute top-0 left-0 w-full bg-slate-100 border-b border-slate-200" style={{ height: '15%' }} />
      
      {/* Door/Drum */}
      <div 
        className="lb-machine-drum rounded-full border-slate-300 border-t-teal-600 box-border"
        style={{ width: '60%', height: '60%', borderWidth: border, marginTop: '10%' }}
      />
      
      {/* Water Level (Decorative) */}
      <div className="absolute bottom-0 w-full bg-teal-500/20" style={{ height: '20%' }} />
    </div>
  );
};

// Variant 2: The Iron Box
// Best for: "Ironing", "Finishing", "Polishing"
const IronLoader: React.FC<BaseLoaderProps> = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size];
  
  return (
    <div className={`relative flex items-end justify-center ${className}`} style={{ width: px, height: px }}>
      {/* Steam Puffs */}
      <div className="lb-steam absolute top-0 right-0 bg-slate-300 rounded-full opacity-0" style={{ width: px*0.15, height: px*0.15, right: '20%', animationDelay: '0.2s' }} />
      <div className="lb-steam absolute top-0 right-0 bg-slate-300 rounded-full opacity-0" style={{ width: px*0.2, height: px*0.2, right: '40%' }} />
      
      {/* The Iron Body */}
      <div className="lb-iron-body relative z-10">
        {/* Handle */}
        <div className="absolute -top-1/2 left-2 rounded-t-lg border-t-4 border-l-4 border-r-4 border-slate-700" style={{ width: px*0.4, height: px*0.3, borderColor: '#334155' }} />
        {/* Base */}
        <div className="bg-teal-600 rounded-tl-full rounded-bl-sm rounded-br-md" 
             style={{ width: px * 0.8, height: px * 0.35, borderBottom: `4px solid ${BRAND.amber}` }} />
      </div>
    </div>
  );
};

// Variant 3: The Hanger
// Best for: "Ready for Delivery", "Order Complete"
const HangerLoader: React.FC<BaseLoaderProps> = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size];
  const stroke = Math.max(2, px * 0.08);
  
  return (
    <div className={`relative flex justify-center ${className}`} style={{ width: px, height: px }}>
       {/* Rack Line */}
       <div className="absolute top-0 w-full bg-slate-200 rounded-full" style={{ height: stroke }} />

       <div className="lb-hanger-swing relative w-full h-full flex justify-center">
         {/* Hook */}
         <div className="absolute border-slate-500 rounded-t-full" 
              style={{ 
                width: px * 0.2, 
                height: px * 0.2, 
                borderTopWidth: stroke, 
                borderRightWidth: stroke, 
                borderLeftWidth: 0,
                borderBottomWidth: 0,
                top: px * 0.1
              }} 
         />
         {/* Triangle Body */}
         <div 
           className="absolute border-teal-600"
           style={{ 
             width: px * 0.8, 
             height: px * 0.35, 
             borderTopWidth: stroke,
             borderBottomWidth: stroke,
             borderRadius: '50% 50% 10% 10%',
             top: px * 0.3
           }} 
         />
         {/* Shirt Body (Optional fill) */}
         <div className="absolute bg-teal-100/50"
             style={{
                width: px * 0.6,
                height: px * 0.4,
                top: px * 0.35,
                borderRadius: '4px',
                zIndex: -1
             }}
         />
       </div>
    </div>
  );
};

// Variant 4: The Cash
// Best for: "Calculating Bill", "Payment Processing"
const CashLoader: React.FC<BaseLoaderProps> = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size];
  const billH = px * 0.5;
  const billW = px * 0.8;
  
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
      {[0, 1, 2].map(i => (
        <div 
          key={i}
          className="lb-cash-bill absolute bg-emerald-600 rounded-sm border border-emerald-400 shadow-sm flex items-center justify-center"
          style={{ 
             width: billW, 
             height: billH,
             animationDelay: `${i * 0.4}s`,
             backgroundColor: i === 1 ? '#059669' : BRAND.teal
          }}
        >
          <div className="w-4 h-4 rounded-full border-2 border-emerald-200/50" />
        </div>
      ))}
    </div>
  );
};

// Variant 5: The Bubbles
// Best for: "Processing", "General Loading"
const BubblesLoader: React.FC<BaseLoaderProps> = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size];
  
  return (
    <div className={`relative flex items-end justify-center gap-1 ${className}`} style={{ width: px, height: px }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="lb-bubble rounded-full bg-teal-400/80"
          style={{ 
             width: px * (0.2 + (i * 0.05)), 
             height: px * (0.2 + (i * 0.05)),
             animationDelay: `${i * 0.3}s` 
          }}
        />
      ))}
    </div>
  );
};

/**
 * ==========================================
 * WRAPPER COMPONENTS
 * ==========================================
 */

interface LLoaderProps extends BaseLoaderProps {
  variant?: LoaderVariant;
}

export const LLoader: React.FC<LLoaderProps> = ({ variant = 'machine', size = 'md', className = '', ...props }) => {
  const loaders = {
    machine: MachineLoader,
    iron: IronLoader,
    hanger: HangerLoader,
    cash: CashLoader,
    bubbles: BubblesLoader
  };
  
  const SelectedLoader = loaders[variant];
  
  return (
    <>
      <style>{LOADER_STYLES}</style>
      <SelectedLoader size={size} className={className} {...props} />
    </>
  );
};

export interface LInlineLoaderProps {
  variant?: LoaderVariant;
  light?: boolean;
  size?: LoaderSize;
  className?: string;
}

export const LInlineLoader: React.FC<LInlineLoaderProps> = ({ 
  variant = 'bubbles', 
  light = true,
  size = 'sm',
  className = ''
}) => {
  const colorClass = light ? 'brightness-200 contrast-0 grayscale' : '';
  return (
    <div className={`inline-block align-middle ${colorClass} ${className}`}>
      <LLoader variant={variant} size={size} />
    </div>
  );
};

export interface LPageLoaderProps {
  variant?: LoaderVariant;
  message?: string;
  className?: string;
}

export const LPageLoader: React.FC<LPageLoaderProps> = ({ 
  variant = 'machine', 
  message = 'Loading...',
  className = ''
}) => {
  return (
    <>
      <style>{LOADER_STYLES}</style>
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/20 backdrop-blur-md ${className}`}>
        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100 min-w-[200px]">
          <LLoader variant={variant} size="xl" />
          {message && (
            <p className="mt-6 text-slate-700 font-bold tracking-wide animate-pulse text-sm uppercase">
              {message}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
