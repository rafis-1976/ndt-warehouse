import React, { useEffect, useState } from 'react';

// Cache para no cargar la librería múltiples veces
let qrModulePromise: Promise<any> | null = null;

export function QRCodeSVG({ 
  value, 
  size = 100, 
  className = '',
  level = 'M'
}: { 
  value: string, 
  size?: number, 
  className?: string,
  level?: 'L' | 'M' | 'Q' | 'H'
}) {
  const [Component, setComponent] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!qrModulePromise) {
      // Cargamos la librería desde un CDN ESM (sin necesidad de npm install)
      qrModulePromise = import('https://esm.sh/qrcode.react@1.0.1')
        .then((mod) => mod.QRCodeSVG || mod.default)
        .catch((err) => {
          console.error('Error cargando qrcode.react:', err);
          throw err;
        });
    }

    qrModulePromise
      .then((Comp) => {
        if (isMounted) setComponent(() => Comp);
      })
      .catch(() => {
        if (isMounted) setError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    // Fallback visual si falla la carga
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`bg-gray-100 border border-gray-300 flex items-center justify-center text-xs text-gray-400 ${className}`}
      >
        QR Error
      </div>
    );
  }

  if (!Component) {
    // Placeholder mientras carga (muy rápido, milisegundos)
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`bg-gray-50 animate-pulse rounded ${className}`}
      />
    );
  }

  return (
    <Component 
      value={value || ' '} 
      size={size} 
      level={level} 
      className={className}
      includeMargin={false}
    />
  );
}