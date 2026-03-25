"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  clearAuthSession,
  getAuthSession,
  type StoredUser,
} from "../../lib/auth-storage";

type NavbarLayoutProps = {
  children: ReactNode;
  hideAuthAction?: boolean;
};

const SIDEBAR_STATE_KEY = "vidai-sidebar-collapsed";

type IconProps = {
  className?: string;
};

function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H4" strokeLinecap="round" />
      <path d="M20 4v16" strokeLinecap="round" />
    </svg>
  );
}

function PanelLeftCloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 6h16" strokeLinecap="round" />
      <path d="M4 12h10" strokeLinecap="round" />
      <path d="M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function PanelLeftOpenIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 6h16" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-3 text-sm font-medium text-white"
          : "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-app-muted transition hover:bg-white/[0.04] hover:text-white"
      }
      title={collapsed ? label : undefined}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-app-line bg-white/[0.03] text-white">
        {icon}
      </span>
      {collapsed ? null : <span>{label}</span>}
    </Link>
  );
}

export function NavbarLayout({
  children,
  hideAuthAction = false,
}: NavbarLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getAuthSession()?.user ?? null;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function handleLogout() {
    clearAuthSession();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (user) {
    return (
      <div className="min-h-screen">
        <div className="fixed left-0 right-0 top-0 z-40 flex h-20 items-center justify-between border-b border-app-line bg-app-bg px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-white"
          >
            VidAI
          </Link>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full text-app-muted transition hover:bg-white/[0.05] hover:text-white"
            aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </button>
        </div>

        <aside
          className={`fixed bottom-0 left-0 z-30 border-r border-app-line bg-app-bg transition-all duration-200 ${
            sidebarCollapsed ? "w-[88px]" : "w-[255px]"
          } top-20`}
        >
          <div className="flex h-full flex-col px-4 py-5">
            <nav className="grid gap-2">
              <SidebarLink
                href="/"
                label="New Project"
                icon={<PlusIcon />}
                active={pathname === "/"}
                collapsed={sidebarCollapsed}
              />
              <SidebarLink
                href="/projects"
                label="My Projects"
                icon={<FolderIcon />}
                active={pathname === "/projects"}
                collapsed={sidebarCollapsed}
              />
            </nav>

            <div className="mt-auto space-y-3 pt-6">
              <button
                type="button"
                onClick={handleLogout}
                className={`flex w-full rounded-2xl px-3 py-3 text-sm text-red-300 transition hover:bg-red-500/[0.08] ${
                  sidebarCollapsed ? "justify-center" : "items-center gap-3"
                }`}
                title={sidebarCollapsed ? "Logout" : undefined}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                  <LogoutIcon />
                </span>
                {sidebarCollapsed ? null : <span>Logout</span>}
              </button>

              <div
                className={`flex rounded-2xl border border-app-line bg-white/[0.03] px-3 py-3 ${
                  sidebarCollapsed ? "justify-center" : "items-center gap-3"
                }`}
                title={sidebarCollapsed ? user.email : undefined}
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-app-line bg-white/[0.06] text-sm font-medium text-white">
                  {user.email.slice(0, 1).toUpperCase()}
                </div>
                {sidebarCollapsed ? null : (
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Account</div>
                    <div className="mt-1 truncate text-xs text-app-muted">
                      {user.email}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main
          className={`min-h-screen px-4 pb-6 pt-28 sm:px-6 lg:px-10 ${
            sidebarCollapsed ? "ml-[88px]" : "ml-[255px]"
          }`}
        >
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="site-container">
      <nav className="site-header">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
          VidAI
        </Link>

        {hideAuthAction ? (
          <div />
        ) : (
          <Link href="/login" className="button-secondary">
            Sign in
          </Link>
        )}
      </nav>

      {children}
    </div>
  );
}
