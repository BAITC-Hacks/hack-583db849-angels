interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Panel({ glass, className, children, ...rest }: PanelProps) {
  const base = 'rounded-panel border border-border-subtle p-6 sm:p-8';
  const surface = glass ? 'bg-bg-surface/60 backdrop-blur-xl' : 'bg-bg-surface';

  return (
    <div className={`${base} ${surface} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}
