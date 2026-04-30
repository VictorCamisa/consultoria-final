import logoLight from '@/assets/vs-logo-light.png';
import logoDark from '@/assets/vs-logo-dark.png';

interface VSLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'mark';
  /**
   * 'light' = logo claro (V branco) — para fundos escuros (site)
   * 'dark'  = logo escuro (V azul/preto) — para fundos claros (sistema)
   */
  theme?: 'light' | 'dark';
}

const sizes = {
  sm: 32,
  md: 44,
  lg: 64,
};

export default function VSLogo({
  className = '',
  size = 'md',
  theme = 'light',
}: VSLogoProps) {
  const h = sizes[size];
  const src = theme === 'dark' ? logoDark : logoLight;

  return (
    <img
      src={src}
      alt="VS Soluções"
      style={{ height: h, width: 'auto' }}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}
