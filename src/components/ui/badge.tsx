'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'pass' | 'fail' | 'unknown' | 'processing' | 'secondary';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-[#1f2937] text-[#f5f5f5] border-[#374151]',
      pass: 'badge-pass',
      fail: 'badge-fail',
      unknown: 'badge-unknown',
      processing: 'badge-processing',
      secondary: 'bg-[#262626] text-[#a3a3a3] border-[#2a2a2a]',
    };

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          border
          ${variants[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

interface StatusBadgeProps {
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'pending' | 'processing' | 'completed' | 'failed';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    PASS: { variant: 'pass' as const, label: 'PASS' },
    FAIL: { variant: 'fail' as const, label: 'FAIL' },
    UNKNOWN: { variant: 'unknown' as const, label: 'UNKNOWN' },
    pending: { variant: 'secondary' as const, label: 'Pending' },
    processing: { variant: 'processing' as const, label: 'Processing' },
    completed: { variant: 'pass' as const, label: 'Completed' },
    failed: { variant: 'fail' as const, label: 'Failed' },
  };

  const config = statusConfig[status] || statusConfig.UNKNOWN;

  return (
    <Badge variant={config.variant}>
      {status === 'processing' && (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {config.label}
    </Badge>
  );
}
