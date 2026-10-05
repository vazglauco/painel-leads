'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Profile } from '@/lib/auth';

type Name = 'today' | 'triage' | 'returns' | 'activity' | 'settings';

function NavIcon({ name }: { name: Name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...common}>
    {name === 'today' && <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>}
    {name === 'triage' && <><path d="M4 5h16M4 12h16M4 19h16"/><path d="m6 5 1 1 2-2M6 12l1 1 2-2M6 19l1 1 2-2"/></>}
    {name === 'returns' && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    {name === 'activity' && <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>}
    {name === 'settings' && <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="10" cy="18" r="2" fill="white"/></>}
  </svg>;
}

export function Navigation({ role, mobile = false }: { role: Profile['role']; mobile?: boolean }) {
  const pathname = usePathname();
  const items: { href: string; label: string; icon: Name; active: boolean }[] = [
    { href: '/', label: 'Hoje', icon: 'today', active: pathname === '/' },
    ...(role === 'gestor' ? [{ href: '/admin', label: 'Triagem', icon: 'triage' as Name, active: pathname === '/admin' || pathname.startsWith('/admin/import') }] : []),
    { href: '/retornos', label: 'Retornos', icon: 'returns', active: pathname.startsWith('/retornos') },
    { href: '/atividade', label: 'Atividade', icon: 'activity', active: pathname.startsWith('/atividade') },
    ...(role === 'gestor' ? [{ href: '/admin/settings', label: mobile ? 'Ajustes' : 'Configurações', icon: 'settings' as Name, active: pathname.startsWith('/admin/settings') }] : [])
  ];
  return <nav className={mobile ? 'mobile-nav' : 'desktop-nav'} aria-label={mobile ? 'Navegação móvel' : 'Navegação principal'}>
    {items.map(item => <Link key={item.href} href={item.href} className={item.active ? 'active' : undefined} aria-current={item.active ? 'page' : undefined}>
      {mobile && <NavIcon name={item.icon} />}<span>{item.label}</span>
    </Link>)}
  </nav>;
}
