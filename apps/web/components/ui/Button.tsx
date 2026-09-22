interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({ loading, variant = 'primary', disabled, className, children, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base';
  const variants = {
    primary: 'bg-brand-green text-on-brand shadow-green hover:bg-brand-dim hover:shadow-green-lg',
    secondary: 'border border-border-strong bg-transparent text-text-primary hover:bg-bg-elevated',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className ?? ''}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
