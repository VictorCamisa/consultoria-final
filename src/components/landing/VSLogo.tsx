interface VSLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'mark';
}

const sizes = {
  sm: { mark: 28, fontSize: 15, sub: 8.5 },
  md: { mark: 36, fontSize: 19, sub: 10 },
  lg: { mark: 48, fontSize: 26, sub: 13 },
};

export default function VSLogo({ className = '', size = 'md', variant = 'full' }: VSLogoProps) {
  const s = sizes[size];

  if (variant === 'mark') {
    return (
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="VS Soluções"
      >
        <rect width="48" height="48" rx="10" fill="#FF5300" />
        <text
          x="50%"
          y="54%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontFamily="Poppins, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="22"
          letterSpacing="-1"
        >
          VS
        </text>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="VS Soluções">
      {/* Logomark */}
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <rect width="48" height="48" rx="10" fill="#FF5300" />
        {/* Orange corner accent */}
        <rect x="0" y="36" width="12" height="12" rx="0" fill="rgba(0,0,0,0.15)" />
        <rect x="36" y="0" width="12" height="12" rx="0" fill="rgba(255,255,255,0.15)" />
        <text
          x="50%"
          y="54%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontFamily="Poppins, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="22"
          letterSpacing="-1"
        >
          VS
        </text>
      </svg>

      {/* Wordmark */}
      <svg
        viewBox="0 0 110 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ height: s.mark * 0.65, width: 'auto' }}
      >
        <text
          x="0"
          y="21"
          fill="white"
          fontFamily="Poppins, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize={s.fontSize}
          letterSpacing="-0.5"
        >
          VS
        </text>
        <text
          x="0"
          y="33"
          fill="#FF5300"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          fontSize={s.sub}
          letterSpacing="3"
        >
          SOLUÇÕES
        </text>
      </svg>
    </div>
  );
}
