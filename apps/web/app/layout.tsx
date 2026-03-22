import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BizBrain",
  description: "Founder-focused opportunity discovery dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="appShell">
          <aside className="sidebar">
            <div className="sidebarBrand">
              <p className="eyebrow">BizBrain</p>
              <p className="sidebarTitle">Admin</p>
            </div>
            <nav className="sidebarNav">
              <Link className="sidebarLink" href="/">
                Operations
              </Link>
              <Link className="sidebarLink" href="/research-streams">
                Research Streams
              </Link>
              <Link className="sidebarLink" href="/topics">
                Topics
              </Link>
              <Link className="sidebarLink" href="/social-drafts">
                Social Drafts
              </Link>
              <Link className="sidebarLink" href="/frameworks">
                Frameworks
              </Link>
              <Link className="sidebarLink" href="/style-profiles">
                Style Profiles
              </Link>
            </nav>
          </aside>
          <div className="appContent">{children}</div>
        </div>
      </body>
    </html>
  );
}
