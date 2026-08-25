'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { LoginForm } from '@/app/login/login-form';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (auth.status === 'authenticated') {
      router.replace('/sessions');
    }
  }, [auth.status, router]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    // auth.error already surfaces the failure message — this catch only
    // exists so the rejection auth.login() rethrows doesn't go unhandled.
    auth.login(usernameInput, passwordInput).catch(() => {});
  }

  if (auth.status === 'checking' || auth.status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <LoginForm
        usernameInput={usernameInput}
        passwordInput={passwordInput}
        onUsernameInputChange={setUsernameInput}
        onPasswordInputChange={setPasswordInput}
        onSubmit={handleSubmit}
        error={auth.error}
      />
    </main>
  );
}
