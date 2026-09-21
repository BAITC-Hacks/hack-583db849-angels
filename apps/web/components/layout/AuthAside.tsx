'use client';

import {
  ChartBarSquareIcon,
  DocumentTextIcon,
  IdentificationIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { DotField } from '../ui/DotField';

/**
 * Right half of the split-screen auth pages, and deliberately different on each
 * one: the sign-in side answers "is my data safe here", the registration side
 * answers "what am I about to spend my evening on". Every claim is one the S1
 * contract or the university's own pages support — no invented numbers, and no
 * promises about screens that later slices still have to build.
 *
 * Text only by intention. Photographs belong on the public pages; beside a form
 * they competed with the fields for attention without telling the applicant
 * anything they needed in order to fill it in.
 */
const security = [
  { key: 'iin', icon: IdentificationIcon, text: 'The IIN is encrypted at rest, excluded from assessment and never returned in responses' },
  { key: 'password', icon: LockClosedIcon, text: 'The password is stored only as an Argon2id hash and cannot be recovered' },
  { key: 'evidence', icon: ChartBarSquareIcon, text: 'Under every score: an indicator, a quote and a timestamp — there is no black box' },
  { key: 'commission', icon: UserGroupIcon, text: 'The commission decides who is invited to interview, not the model' },
] as const;

const needed = [
  'Full name as in your document',
  'Email and year of birth',
  'A 12-digit IIN',
  'A passphrase of at least 15 characters',
] as const;

const path = [
  { key: 'application', icon: DocumentTextIcon, title: 'Application', body: 'Questions come from the published form version' },
  { key: 'test', icon: ChartBarSquareIcon, title: 'Test', body: 'Blocks of statements with no “right” answers' },
  { key: 'video', icon: VideoCameraIcon, title: 'Video', body: 'Preview and confirmation before sending, at least 60 seconds' },
] as const;

/**
 * What inVision U publishes about itself (invisionu.education, read
 * 2026-09-20). Nothing inferred or rounded up.
 */
const facts = [
  { label: 'Duration', value: '4 years' },
  { label: 'Foundation', value: '1 year' },
  { label: 'Programmes', value: '5' },
  { label: 'Campus', value: 'Almaty' },
] as const;

export function AuthAside({ variant }: { variant: 'login' | 'register' }) {
  const isLogin = variant === 'login';

  return (
    <aside className="relative hidden overflow-hidden border-l border-border-subtle bg-bg-elevated lg:flex lg:flex-col lg:justify-center lg:gap-7 lg:px-12 lg:py-10">
      <DotField className="absolute inset-0 h-full w-full" />

      <div className="relative flex max-w-md flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
            {isLogin ? 'Your data' : 'What comes next'}
          </p>
          <h2 className="text-balance-tight text-lg font-bold">
            {isLogin ? 'What is not arranged the usual way here' : 'Three steps after registration'}
          </h2>
        </div>

        {isLogin ? (
          <ul className="flex flex-col gap-3.5">
            {security.map((item) => (
              <li key={item.key} className="flex items-start gap-3">
                <item.icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-ink" />
                <span className="text-sm text-text-secondary">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="flex flex-col gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle">
              {path.map((step) => (
                <li key={step.key} className="flex items-start gap-3 bg-bg-base p-3.5">
                  <step.icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-ink" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-text-primary">{step.title}</span>
                    <span className="text-sm text-text-secondary">{step.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <p className="font-mono text-[0.62rem] tracking-[0.14em] text-text-muted uppercase">
                What you need right now
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {needed.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-green" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border-subtle bg-border-subtle">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.5 bg-bg-base px-4 py-3">
              <span className="font-mono text-[0.58rem] tracking-[0.12em] text-text-muted uppercase">
                {fact.label}
              </span>
              <span className="text-sm font-bold text-text-primary">{fact.value}</span>
            </div>
          ))}
        </div>

        <p className="flex items-start gap-2.5 text-sm text-text-muted">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          {isLogin
            ? 'A synthetic pitch environment: there is no real applicant data here.'
            : 'The application is submitted once — a review screen with a video preview comes first.'}
        </p>
      </div>
    </aside>
  );
}
