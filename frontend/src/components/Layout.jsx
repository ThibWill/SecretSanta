import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../AuthContext.jsx';
import { Garland } from './Decorations.jsx';

const PARTICIPANT_TABS = [
  { to: '/', icon: '🎁', label: 'Mon tirage' },
  { to: '/ma-lettre', icon: '✉️', label: 'Ma lettre' },
  { to: '/lettres', icon: '📜', label: 'Les lettres' },
];
const ADMIN_TABS = [
  { to: '/admin', icon: '⭐', label: 'Admin' },
  { to: '/lettres', icon: '📜', label: 'Les lettres' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const tabs = user.isParticipant ? PARTICIPANT_TABS : ADMIN_TABS;

  return (
    <div className="layout">
      <header className="site-header">
        <div className="header-inner">
          <p className="site-title">
            <span className="site-title-icon" aria-hidden="true">🎄 </span>Secret Santa
          </p>
          <div className="header-user">
            <span className="user-name">{user.name}</span>
            <button type="button" className="btn-logout" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </div>
        <Garland />
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        <ul>
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end className="nav-link">
                <span className="nav-icon" aria-hidden="true">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
