'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { RegisterForm } from '@/app/register/register-form';
import { PendingApprovalView } from '@/app/register/pending-approval-view';

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      router.replace('/sessions');
    }
  }, [auth.status, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (passwordInput !== confirmPasswordInput) {
      setValidationError('Passwords do not match');
      return;
    }
    setValidationError(null);
    // auth.error already surfaces the failure message — this catch only
    // exists so the rejection auth.register() rethrows doesn't go unhandled.
    auth
      .register(usernameInput, passwordInput)
      .then(() => {
        setPasswordInput('');
        setConfirmPasswordInput('');
      })
      .catch(() => {});
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
      {auth.status === 'pending' ? (
        <PendingApprovalView />
      ) : (
        <RegisterForm
          usernameInput={usernameInput}
          passwordInput={passwordInput}
          confirmPasswordInput={confirmPasswordInput}
          onUsernameInputChange={setUsernameInput}
          onPasswordInputChange={setPasswordInput}
          onConfirmPasswordInputChange={setConfirmPasswordInput}
          onSubmit={handleSubmit}
          error={validationError ?? auth.error}
        />
      )}
    </main>
  );
}
