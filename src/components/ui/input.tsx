'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, icon, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const isPassword = type === 'password';

        return (
            <div className="space-y-2">
                {label && (
                    <motion.label
                        className="block text-sm font-medium text-foreground/80"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {label}
                    </motion.label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        type={isPassword && showPassword ? 'text' : type}
                        className={cn(
                            'flex h-12 w-full rounded-xl border bg-card px-4 py-2 text-base',
                            'placeholder:text-muted-foreground',
                            'transition-all duration-200 focus-ring',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            icon && 'pl-10',
                            isPassword && 'pr-10',
                            error
                                ? 'border-destructive focus:ring-destructive'
                                : 'border-input hover:border-primary/50',
                            isFocused && 'border-primary ring-2 ring-primary/20',
                            className
                        )}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    )}
                </div>
                {error && (
                    <motion.p
                        className="text-sm text-destructive"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {error}
                    </motion.p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
