'use client';

import { useState } from 'react';
import { AuthAside } from '../../../components/layout/AuthAside';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Logo } from '../../../components/ui/Logo';
import { TextField } from '../../../components/ui/TextField';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { useApiErrorText } from '../../../lib/api/errorPresentation';
import { useAuth } from '../../../lib/auth/AuthContext';
import { minEligibleBirthYear, validateRegisterFields, type FieldErrors } from '../../../lib/validation/identity';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const describeApiError = useApiErrorText();

  const [email, setEmail] = useState('');
  const [iin, setIin] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsedBirthYear = birthYear.trim() ? Number(birthYear) : null;
    const errors = validateRegisterFields({ email, iin, fullName, birthYear: parsedBirthYear, password });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await register({ email, iin, fullName, birthYear: parsedBirthYear as number, password });
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
          <Link href="/stand" className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink">
            <Logo markSize={24} subtitle={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <h1 className="text-balance-tight text-2xl font-extrabold">Create an applicant account</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {'Already have an account?'}{' '}
              <Link href="/stand/login" className="font-medium text-brand-ink hover:underline">
                Sign in
              </Link>
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
              {formError ? <Alert>{formError}</Alert> : null}

              <TextField
                label="Full name"
                autoComplete="name"
                placeholder="As in your document"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                errors={fieldErrors.fullName}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
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
                  label="Year of birth"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={minEligibleBirthYear()}
                  placeholder="2007"
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                  errors={fieldErrors.birthYear}
                  required
                />
              </div>

              <TextField
                label="IIN"
                inputMode="numeric"
                maxLength={12}
                placeholder="12 digits"
                value={iin}
                onChange={(event) => setIin(event.target.value)}
                errors={fieldErrors.iin}
                hint="Encrypted at rest, excluded from assessment, never written to logs"
                required
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                errors={fieldErrors.password}
                hint="15 to 128 characters. Stored only as an Argon2id hash"
                required
              />

              <Button type="submit" loading={submitting} className="mt-1 w-full">
                Create account
              </Button>
            </form>

            <p className="mt-5 border-l-2 border-border-strong pl-3 text-xs text-text-muted">
              The application is written and assessed in English.
            </p>
          </div>
        </div>
      </div>

      <AuthAside variant="register" />
    </main>
  );
}
