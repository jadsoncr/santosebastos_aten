import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden", className)} {...props}>
    {children}
  </div>
);

export const Button = ({ 
  children, 
  variant = 'primary', 
  className,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'neutral' }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50",
    neutral: "bg-gray-100 text-gray-600 hover:bg-gray-200"
  };
  
  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 text-sm",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Badge = ({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider", className)} {...props}>
    {children}
  </span>
);
