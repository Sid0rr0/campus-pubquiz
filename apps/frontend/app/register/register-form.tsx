import type { FormEvent } from 'react';
import Link from 'next/link';
import { PasswordInput } from '@/app/components/password-input';

interface RegisterFormProps {
  usernameInput: string;
  passwordInput: string;
  confirmPasswordInput: string;
  onUsernameInputChange: (value: string) => void;
  onPasswordInputChange: (value: string) => void;
  onConfirmPasswordInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error?: string | null;
}

export function RegisterForm({
  usernameInput,
  passwordInput,
  confirmPasswordInput,
  onUsernameInputChange,
  onPasswordInputChange,
  onConfirmPasswordInputChange,
  onSubmit,
  error,
}: RegisterFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex w-72 flex-col gap-2">
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <label
        htmlFor="register-username"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Username
      </label>
      <input
        id="register-username"
        value={usernameInput}
        onChange={(event) => onUsernameInputChange(event.target.value)}
        autoComplete="username"
        className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      <label
        htmlFor="register-password"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Password
      </label>
      <PasswordInput
        id="register-password"
        value={passwordInput}
        onChange={onPasswordInputChange}
        autoComplete="new-password"
      />
      <label
        htmlFor="register-confirm-password"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Confirm password
      </label>
      <PasswordInput
        id="register-confirm-password"
        value={confirmPasswordInput}
        onChange={onConfirmPasswordInputChange}
        autoComplete="new-password"
      />
      <button
        type="submit"
        className="mt-2 min-h-12 rounded-xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
      >
        Register
      </button>
      <Link href="/login" className="mt-1 text-sm font-bold underline">
        Already have an account? Log in
      </Link>
    </form>
  );
}
