import type { Metadata } from "next";
import localFont from "next/font/local";
import { Navbar } from "../components/layout/navbar";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "VidAI",
  description: "VidAI turns prompts into short AI videos with a clean creator-first workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Navbar />
        <main className="app-shell">
          <div className="app-shell-inner">{children}</div>
        </main>
      </body>
    </html>
  );
}
