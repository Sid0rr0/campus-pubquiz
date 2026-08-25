import type { SubmitEvent } from 'react';
import Link from 'next/link';
import { EnterIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import { PasswordInput } from '@/app/components/password-input';

interface LoginFormProps {
  usernameInput: string;
  passwordInput: string;
  onUsernameInputChange: (value: string) => void;
  onPasswordInputChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  error?: string | null;
}

export function LoginForm({
  usernameInput,
  passwordInput,
  onUsernameInputChange,
  onPasswordInputChange,
  onSubmit,
  error,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex w-72 flex-col gap-2">
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <label
        htmlFor="login-username"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Username
      </label>
      <input
        id="login-username"
        value={usernameInput}
        onChange={(event) => onUsernameInputChange(event.target.value)}
        autoComplete="username"
        className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      <label
        htmlFor="login-password"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Password
      </label>
      <PasswordInput
        id="login-password"
        value={passwordInput}
        onChange={onPasswordInputChange}
        autoComplete="current-password"
      />
      <Button
        type="submit"
        variant="solid"
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl text-lg"
      >
        <EnterIcon aria-hidden="true" />
        Log in
      </Button>
      <Link href="/register" className="mt-1 text-sm font-bold underline">
        Need an account? Register
      </Link>
    </form>
  );
}
