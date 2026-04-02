import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { site } from '@/lib/config/site'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
}

const navItems = [
  { href: '/dashboard', label: 'Jobs' },
  { href: '/profile', label: 'Profile' },
]

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="workspace-shell">
          <aside className="workspace-sidebar">
            <Link className="workspace-brand" href="/dashboard">
              <span className="workspace-brand-mark">DSJ</span>
              <span className="workspace-brand-copy">
                <strong>{site.name}</strong>
                <span>{site.tagline}</span>
              </span>
            </Link>

            <nav className="workspace-nav" aria-label="Primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="workspace-meta">
              <p>internal workspace</p>
              <p>remote-only queue</p>
              <p>manual apply flow</p>
            </div>
          </aside>

          <div className="workspace-main">{children}</div>
        </div>
      </body>
    </html>
  )
}
