'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Alert, Button, Card, Field } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const email = String(form.get('email'));
      const password = String(form.get('password'));
      if (mode === 'login') await login({ email, password });
      else
        await register({
          email,
          password,
          name: String(form.get('name')),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.path, x.message])));
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {mode === 'login'
            ? 'Log in to manage your channels.'
            : 'Manage all your social accounts in one place.'}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <Field label="Name" name="name" required autoComplete="name" error={fieldErrors.name} />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            error={fieldErrors.email}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            minLength={mode === 'register' ? 10 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            error={fieldErrors.password}
          />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <Link className="text-indigo-600 hover:underline" href="/register">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link className="text-indigo-600 hover:underline" href="/login">
                Log in
              </Link>
            </>
          )}
        </p>
      </Card>
    </main>
  );
}
