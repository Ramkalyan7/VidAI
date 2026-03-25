import Link from "next/link";
import { ReactNode } from "react";

type NavbarLayoutProps = {
  children: ReactNode;
  hideAuthAction?: boolean;
};

export function NavbarLayout({
  children,
  hideAuthAction = false,
}: NavbarLayoutProps) {
  return (
    <div className="site-container">
      <nav className="site-header">
        <Link href="/" className="text-xl font-semibold tracking-tight text-white">
          VidAI
        </Link>

        {hideAuthAction ? <div /> : <Link href="/login" className="button-secondary">Sign in</Link>}
      </nav>

      {children}
    </div>
  );
}
