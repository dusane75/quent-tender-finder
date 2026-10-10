import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `${APP_NAME} — Government tenders for Indian businesses`,
  description:
    "Get government tenders that match your work on WhatsApp, in Marathi, Hindi or English. Check eligibility and prepare your bid papers. You always submit your own bid.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;800&family=Tiro+Devanagari+Hindi&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href={user ? "/dashboard" : "/"} className="brand">
              <span className="dot" /> {APP_NAME}
            </Link>
            <nav className="nav">
              {user ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/tenders/new">Add tender</Link>
                  <Link href="/settings">Settings</Link>
                </>
              ) : (
                <>
                  <Link href="/#pricing">Pricing</Link>
                  <Link href="/login" className="btn small">Start free</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <div className="wrap row between">
            <span>{APP_NAME} · Made in Nashik</span>
            <span className="row">
              <Link href="/privacy">Privacy</Link>
              <span>We never submit bids on your behalf.</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
