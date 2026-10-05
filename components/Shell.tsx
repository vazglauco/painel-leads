import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import type { Profile } from '@/lib/auth';
import { Navigation } from './Navigation';

export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <Link href="/" className="brand" aria-label="Atori Leads, página inicial">atori<span className="brand-dot">.</span></Link>
      <Navigation role={profile.role} />
      <div className="topbar-user"><span className="user-avatar" aria-hidden="true">{(profile.full_name || profile.email).trim().charAt(0).toUpperCase()}</span><span className="user-name">{profile.full_name || profile.email}</span><form action={logoutAction}><button className="text-button">Sair</button></form></div>
    </div></header>
    <div className="page-wrap">{children}</div>
    <Navigation role={profile.role} mobile />
  </div>;
}
