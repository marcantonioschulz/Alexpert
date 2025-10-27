import { Link, Outlet, useLocation } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link to="/" className={styles.logo}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.logoIcon}
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.logoText}>Alexpert</span>
          </Link>

          <nav className={styles.nav}>
            <Link
              to="/"
              className={`${styles.navLink} ${location.pathname === '/' ? styles.navLinkActive : ''}`}
            >
              Home
            </Link>
            <Link
              to="/settings"
              className={`${styles.navLink} ${location.pathname === '/settings' ? styles.navLinkActive : ''}`}
            >
              Einstellungen
            </Link>
          </nav>

          <div className={styles.userMenuWrapper}>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
