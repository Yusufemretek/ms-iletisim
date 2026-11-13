import { useState } from 'react';

interface LogoProps {
  size?: number;
  rounded?: string;
  className?: string;
  bg?: string;
}

export function Logo({ size = 36, rounded = 'rounded-xl', className = '', bg = 'bg-black' }: LogoProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-electric-500 font-bold text-white ${rounded} ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        MS
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center shrink-0 ${bg} ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.png"
        alt="MS İletişim logosu"
        onError={() => setError(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
