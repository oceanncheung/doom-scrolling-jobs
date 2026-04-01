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
  { href: '/', label: 'Foundation' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/api/health', label: 'Health' },
]

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-glow page-glow-left" />
        <div className="page-glow page-glow-right" />
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand" href="/">
              <span className="brand-mark">DSJ</span>
              <span className="brand-copy">
                <strong>{site.name}</strong>
                <span>{site.tagline}</span>
              </span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
