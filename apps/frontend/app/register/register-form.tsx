import type { SubmitEvent } from 'react';
import Link from 'next/link';
import { PersonIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import { PasswordInput } from '@/app/components/password-input';

interface RegisterFormProps {
  usernameInput: string;
  passwordInput: string;
  confirmPasswordInput: string;
  onUsernameInputChange: (value: string) => void;
  onPasswordInputChange: (value: string) => void;
  onConfirmPasswordInputChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
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
      <Button
        type="submit"
        variant="solid"
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl text-lg"
      >
        <PersonIcon aria-hidden="true" />
        Register
      </Button>
      <Link href="/login" className="mt-1 text-sm font-bold underline">
        Already have an account? Log in
      </Link>
    </form>
  );
}
