import { ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AlertProps {
  variant?: 'error' | 'info';
  children: React.ReactNode;
  /** Present only where the message is news the reader can finish with. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function Alert({ variant = 'error', children, onDismiss, dismissLabel }: AlertProps) {
  const styles =
    variant === 'error'
      ? 'border-status-low/30 bg-status-low/10 text-status-low font-medium'
      : 'border-status-ai/30 bg-status-ai/10 text-status-ai';
  const Icon = variant === 'error' ? ExclamationTriangleIcon : InformationCircleIcon;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm ${styles}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <span className="flex-1">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? 'Close'}
          className="-mr-1 shrink-0 rounded-control p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <XMarkIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
