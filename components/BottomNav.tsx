'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Barre de navigation basse.
 *
 * Trois entrées, pas cinq : sur 390 px de large et avec un pouce, une cible de
 * navigation en dessous de ~64 px de large se rate. Le reste (annonce, détail
 * d'exemplaire) s'atteint depuis une fiche, ce ne sont pas des destinations.
 */
const ITEMS = [
  { href: '/', label: 'Accueil', icon: HomeIcon },
  { href: '/scan', label: 'Scanner', icon: ScanIcon },
  { href: '/stock', label: 'Stock', icon: StockIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px]
                 border-t border-line bg-bg/85 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <ul className="flex">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 transition-colors
                            ${active ? 'text-ink' : 'text-muted'}`}
              >
                <Icon active={active} />
                <span className="text-[11px] font-semibold">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { active: boolean };
const base = 'h-[22px] w-[22px]';

function HomeIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base} fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function ScanIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" strokeLinecap="round" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function StockIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="5" height="16" rx="1.2" fill={active ? 'currentColor' : 'none'} />
      <rect x="9.5" y="4" width="5" height="16" rx="1.2" />
      <path d="M17.2 5.4 21 6.4l-3 14-3.6-1z" strokeLinejoin="round" />
    </svg>
  );
}
