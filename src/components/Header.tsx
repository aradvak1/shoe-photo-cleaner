"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const PRIMARY_LINKS = [
  { href: "/create", label: "עריכת תמונה" },
  { href: "/catalog", label: "קטלוג" },
];

const SECONDARY_LINKS = [
  { href: "/photos", label: "גלריה" },
  { href: "/templates", label: "תבניות" },
  { href: "/logos", label: "לוגואים" },
];

function NavLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`relative pb-1.5 transition-colors ${className} ${
        isActive ? "text-accent" : "hover:text-accent"
      }`}
    >
      {label}
      {isActive && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-x-0 -bottom-px h-px bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
    </Link>
  );
}

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3.5">
        <Link
          href="/start"
          className="font-display text-lg tracking-wide text-ink"
        >
          PHOTOS EDITOR
        </Link>
        <div className="flex items-center gap-5">
          {PRIMARY_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              className="text-sm font-medium text-ink"
            />
          ))}
        </div>
        <div className="flex items-center gap-4 border-r border-border pr-5">
          {SECONDARY_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              className="text-xs text-muted"
            />
          ))}
        </div>
      </nav>
    </header>
  );
}
