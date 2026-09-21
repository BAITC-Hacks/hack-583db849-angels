'use client';

import { useState } from 'react';
import { AuthAside } from '../../../components/layout/AuthAside';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Logo } from '../../../components/ui/Logo';
import { TextField } from '../../../components/ui/TextField';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiErrorText } from '../../../lib/api/errorPresentation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { validateLoginFields, type FieldErrors } from '../../../lib/validation/identity';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const describeApiError = useApiErrorText();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validateLoginFields({ email, password });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      router.push('/stand');
    } catch (error) {
      const presentation = describeApiError(error);
      setFormError(presentation.message);
      setFieldErrors(presentation.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-bg-base lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            href="/stand"
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
          >
            <Logo markSize={24} subtitle={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-balance-tight text-2xl font-extrabold">Sign in</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {'No account yet?'}{' '}
              <Link href="/stand/register" className="font-medium text-brand-ink hover:underline">
                Create one
              </Link>
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
              {formError ? <Alert>{formError}</Alert> : null}

              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="name@example.kz"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                errors={fieldErrors.email}
                required
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                errors={fieldErrors.password}
                required
              />

              <Button type="submit" loading={submitting} className="mt-1 w-full">
                Sign in
              </Button>
            </form>

            <p className="mt-5 border-l-2 border-border-strong pl-3 text-xs text-text-muted">If the email or the password did not match, the message is the same either way — the system does not hint at which accounts exist.</p>
          </div>
        </div>
      </div>

      <AuthAside variant="login" />
    </main>
  );
}
