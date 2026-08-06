import type { FormEvent } from 'react';

interface AdminLoginFormProps {
  usernameInput: string;
  passwordInput: string;
  onUsernameInputChange: (value: string) => void;
  onPasswordInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchToRegister: () => void;
  error?: string | null;
}

export function AdminLoginForm({
  usernameInput,
  passwordInput,
  onUsernameInputChange,
  onPasswordInputChange,
  onSubmit,
  onSwitchToRegister,
  error,
}: AdminLoginFormProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form onSubmit={onSubmit} className="flex w-72 flex-col gap-2">
        {error && (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        )}
        <label htmlFor="admin-username" className="text-xs font-extrabold tracking-wide text-foreground/55">
          Username
        </label>
        <input
          id="admin-username"
          value={usernameInput}
          onChange={(event) => onUsernameInputChange(event.target.value)}
          autoComplete="username"
          className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
        />
        <label htmlFor="admin-password" className="text-xs font-extrabold tracking-wide text-foreground/55">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          value={passwordInput}
          onChange={(event) => onPasswordInputChange(event.target.value)}
          autoComplete="current-password"
          className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
        />
        <button
          type="submit"
          className="mt-2 min-h-12 rounded-xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
        >
          Log in
        </button>
        <button type="button" onClick={onSwitchToRegister} className="mt-1 text-sm font-bold underline">
          Need an account? Register
        </button>
      </form>
    </main>
  );
}
