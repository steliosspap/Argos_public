'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';
import { generateId } from '@/utils/accessibility';

interface AccessibleSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  placeholder?: string;
  requiredIndicator?: boolean;
}

const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder = 'Select an option',
      requiredIndicator = false,
      id,
      className = '',
      required,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const selectId = id || generateId('select');
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    
    const describedBy = [
      ariaDescribedBy,
      error && errorId,
      hint && hintId
    ].filter(Boolean).join(' ');
    
    return (
      <div className="space-y-2">
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-white"
        >
          {label}
          {required && requiredIndicator && (
            <span className="text-red-400 ml-1" aria-label="required">*</span>
          )}
        </label>
        
        {hint && (
          <p id={hintId} className="text-xs text-gray-400">
            {hint}
          </p>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full px-4 py-3 bg-white/10 border rounded-lg text-white 
              appearance-none cursor-pointer transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-red-500' : 'border-white/20'}
              ${className}
            `}
            required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy || undefined}
            aria-required={required}
            {...props}
          >
            <option value="" disabled className="bg-gray-900 text-gray-400">
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="bg-gray-900 text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Custom arrow icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {error && (
          <p 
            id={errorId} 
            className="text-sm text-red-400 flex items-center space-x-1" 
            role="alert"
            aria-live="polite"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

AccessibleSelect.displayName = 'AccessibleSelect';

export default AccessibleSelect;