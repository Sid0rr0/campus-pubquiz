'use client';

import { useState } from 'react';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

export function PasswordInput({ id, value, onChange, autoComplete }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="min-h-12 w-full rounded-xl border-2 border-foreground/35 bg-white px-4 pr-16 text-lg font-bold"
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold tracking-wide text-foreground/55"
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
