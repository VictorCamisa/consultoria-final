import vsLogo from '@/assets/vs-logo.png';

interface VSLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'mark';
}

const heights = {
  sm: 32,
  md: 44,
  lg: 60,
};

export default function VSLogo({ className = '', size = 'md' }: VSLogoProps) {
  return (
    <img
      src={vsLogo}
      alt="VS Soluções"
      style={{ height: heights[size], width: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
