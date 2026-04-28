'use client'

import { ChevronDown } from 'lucide-react'

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

export function Select({ className = '', children, ...props }: Props) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`appearance-none pr-10 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={1.5}
        className="absolute right-[15px] top-1/2 -translate-y-1/2 text-ink-40 pointer-events-none"
      />
    </div>
  )
}
