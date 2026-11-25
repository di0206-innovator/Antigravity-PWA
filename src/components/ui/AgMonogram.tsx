import { cn } from './cn';

export interface AgMonogramProps {
  size?: number;
  className?: string;
  label?: string;
}

export function AgMonogram({ size = 36, className, label }: AgMonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="#05070d"
        stroke="#1e293b"
        strokeWidth="2"
      />
      <path
        d="M12 46L22 18L32 46"
        stroke="#3b82f6"
        strokeWidth="4.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 37H28"
        stroke="#3b82f6"
        strokeWidth="4.25"
        strokeLinecap="round"
      />
      <path
        d="M51 23.5C49 20 45.5 18 41.5 18C35.2 18 31 23.2 31 32C31 40.8 35.2 46 41.8 46C47.5 46 51.5 42.2 51.5 35.5V32.5H42.5"
        stroke="#8b5cf6"
        strokeWidth="4.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
