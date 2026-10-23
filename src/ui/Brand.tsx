export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="5" width="7" height="22" rx="2" fill="currentColor" />
        <rect x="13" y="11" width="7" height="16" rx="2" fill="currentColor" />
        <rect x="23" y="5" width="6" height="12" rx="2" className="brand-accent" />
      </svg>
      <span className="brand-name">
        <strong>UHD</strong>
        <span>{compact ? 'Student Extension' : 'Student workspace'}</span>
      </span>
    </div>
  );
}
