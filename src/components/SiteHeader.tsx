import { Link } from "@tanstack/react-router";
import { Hexagon, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
  { label: "Platform", href: "/#capability" },
  { label: "How it works", href: "/#pipeline" },
  { label: "Agents", href: "/#agents" },
  { label: "FAQ", href: "/#faq" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-5 sm:px-6 sm:pt-7">
      <div className="mx-auto grid h-[54px] max-w-[880px] grid-cols-[minmax(0,1fr)_auto] items-center rounded-full border border-white/10 bg-black/95 px-2 shadow-[0_14px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl md:grid-cols-[1fr_auto_1fr]">
        <Link to="/" className="flex min-w-0 items-center gap-2 pl-3 text-white" aria-label="TrustRAG home">
          <Hexagon size={23} strokeWidth={1.6} className="shrink-0 text-cyan-400" />
          <span className="truncate text-[17px] font-semibold tracking-[-0.01em]">TrustRAG</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-2 text-[14px] font-medium text-white/75 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <Link to="/login" className="rounded-full px-4 py-2 text-[14px] font-medium text-white/75 transition-colors hover:text-white">
            Log in
          </Link>
          <Link to="/signup" className="rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black transition-transform duration-200 hover:scale-[1.02]">
            Get started
          </Link>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mr-0.5 rounded-full text-white hover:bg-white/10 hover:text-white md:hidden"
        >
          {open ? <X /> : <Menu />}
        </Button>

        {open && (
          <div className="absolute inset-x-4 top-[70px] rounded-2xl border border-white/10 bg-black p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 md:hidden">
            {links.map((item) => (
              <a key={item.label} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
                {item.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
              <Link to="/login" className="rounded-full px-4 py-3 text-center text-sm text-white">Log in</Link>
              <Link to="/signup" className="rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-black">Get started</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}