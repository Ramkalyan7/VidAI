"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearAuthSession, getAuthSession, type StoredUser } from "../../lib/auth-storage";

const SIDEBAR_STATE_KEY = "vidai-sidebar-collapsed";
const DEFAULT_CONTENT_MAX_WIDTH = "56rem";
const SIDEBAR_WIDTH_EXPANDED = "255px";
const SIDEBAR_WIDTH_COLLAPSED = "64px";
const AUTH_TOP_OFFSET = "96px";
const PUBLIC_TOP_OFFSET = "88px";

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

function ChatIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 18l-3 2V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
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
  isActive,
  label,
  icon,
  collapsed,
}: {
  href: string;
  isActive: boolean;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
}) {
  const baseClass = collapsed
    ? "flex justify-center rounded-2xl px-0 py-2.5 text-sm transition"
    : "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition";
  const activeClass = isActive
    ? "bg-white/[0.07] font-medium text-white"
    : "text-app-muted hover:bg-white/[0.04] hover:text-white";

  return (
    <Link
      href={href}
      className={`${baseClass} ${activeClass}`}
      title={collapsed ? label : undefined}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center text-white">
        {icon}
      </span>
      {collapsed ? null : <span>{label}</span>}
    </Link>
  );
}

const navItems: Array<{
  href: string;
  label: string;
  icon: ReactNode;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/",
    label: "New Project",
    icon: <PlusIcon />,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: <ChatIcon />,
    match: (pathname) => pathname.startsWith("/chat"),
  },
  {
    href: "/projects",
    label: "My Projects",
    icon: <FolderIcon />,
    match: (pathname) => pathname.startsWith("/projects"),
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
  });

  useEffect(() => {
    setUser(getAuthSession()?.user ?? null);
  }, [pathname]);

  useEffect(() => {
    function syncUserFromStorage() {
      setUser(getAuthSession()?.user ?? null);
    }

    window.addEventListener("storage", syncUserFromStorage);
    window.addEventListener("focus", syncUserFromStorage);

    return () => {
      window.removeEventListener("storage", syncUserFromStorage);
      window.removeEventListener("focus", syncUserFromStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const root = document.documentElement;
    const isAuthenticated = Boolean(user);
    const sidebarWidth = isAuthenticated ? (sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED) : "0px";
    const topOffset = isAuthenticated ? AUTH_TOP_OFFSET : PUBLIC_TOP_OFFSET;
    const contentMaxWidth = pathname.startsWith("/chat") ? "none" : DEFAULT_CONTENT_MAX_WIDTH;

    root.style.setProperty("--app-sidebar-width", sidebarWidth);
    root.style.setProperty("--app-top-offset", topOffset);
    root.style.setProperty("--app-content-max-width", contentMaxWidth);

    return () => {
      root.style.removeProperty("--app-sidebar-width");
      root.style.removeProperty("--app-top-offset");
      root.style.removeProperty("--app-content-max-width");
    };
  }, [pathname, sidebarCollapsed, user]);

  function handleLogout() {
    clearAuthSession();
    setUser(null);
    setSidebarCollapsed(false);
    router.push("/");
    router.refresh();
  }

  if (user) {
    return (
      <>
        <div className="fixed left-0 right-0 top-0 z-20 border-b border-app-line" />

        <aside
          className={`fixed bottom-0 left-0 z-30 border-r border-app-line bg-app-bg transition-all duration-200 ${
            sidebarCollapsed ? "w-[64px]" : "w-[255px]"
          } top-0`}
        >
          <div className="flex h-full flex-col px-4 py-5">
            <div className="mb-6 flex h-20 items-center justify-between">
              {sidebarCollapsed ? null : (
                <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
                  VidAI
                </Link>
              )}

              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className={`grid h-10 w-10 place-items-center rounded-full text-app-muted transition hover:bg-white/[0.05] hover:text-white ${
                  sidebarCollapsed ? "ml-auto" : ""
                }`}
                aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
                title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
              </button>
            </div>

            <nav className="grid gap-2">
              {navItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={item.match(pathname)}
                  collapsed={sidebarCollapsed}
                />
              ))}
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
                <span className="grid h-5 w-5 shrink-0 place-items-center">
                  <LogoutIcon />
                </span>
                {sidebarCollapsed ? null : <span>Logout</span>}
              </button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  const hideAuthAction = pathname === "/login" || pathname === "/signup";

  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-app-line bg-app-bg/95 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="site-header mb-0 py-5">
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
      </div>
    </div>
  );
}
