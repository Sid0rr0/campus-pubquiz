import type { FormEvent } from 'react';

interface AdminLoginFormProps {
  passwordInput: string;
  onPasswordInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function AdminLoginForm({ passwordInput, onPasswordInputChange, onSubmit }: AdminLoginFormProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form onSubmit={onSubmit} className="flex w-72 flex-col gap-2">
        <label htmlFor="admin-password" className="text-xs font-extrabold tracking-wide text-foreground/55">
          Admin password
        </label>
        <input
          id="admin-password"
          type="password"
          value={passwordInput}
          onChange={(event) => onPasswordInputChange(event.target.value)}
          className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
        />
        <button
          type="submit"
          className="mt-2 min-h-12 rounded-xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
        >
          Connect
        </button>
      </form>
    </main>
  );
}
