type IconName = 'arrow' | 'calendar' | 'plus' | 'info' | 'external';
export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    external: <><path d="M11 3h6v6M17 3l-8 8M8 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" /></>,
    arrow: <><path d="M4 10h12M11 5l5 5-5 5" /></>,
    calendar: <><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M6 2v4m8-4v4M3 8h14M6 11h2m4 0h2m-8 3h2" /></>,
    plus: <path d="M10 4v12M4 10h12" />,
    info: <><circle cx="10" cy="10" r="7" /><path d="M10 9v5m0-8v.2" /></>,
  };
  return <svg className="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
