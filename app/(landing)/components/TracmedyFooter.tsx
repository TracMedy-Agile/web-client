'use client'
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import Image from "next/image";
const TracmedyFooter = () => {
 
  return (
    <>
      <footer className="bg-footer pt-20 pb-10 text-footer-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-muted-foreground/20">
            {/* Logo + Brand Description */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden">
                  <Image src="/tracmedy_logo.svg" alt="Tracmedy logo" width={40} height={40} className="h-full w-full object-cover" />
                </div>
                <span className="text-lg font-bold md:text-xl tracking-tight text-primary-foreground">Tracmedy</span>
              </div>
              <p className="leading-relaxed text-sm">
                Tracmedy is the bridge connecting hospital visits to structured recovery at home.
              </p>
            </div>
 
            {/* Navigate */}
            <div>
              <h5 className="text-primary-foreground font-bold mb-4">Navigate</h5>
              <ul className="space-y-3 text-sm">
                <li><a className="hover:text-primary transition-colors" href="#problem">The Problem</a></li>
                <li><a className="hover:text-primary transition-colors" href="#solution">Solution</a></li>
                <li><a className="hover:text-primary transition-colors" href="#how-it-works">How It Works</a></li>
                <li><a className="hover:text-primary transition-colors" href="#waitlist">Join Waitlist</a></li>
              </ul>
            </div>
 
            {/* Contact */}
            <div>
              <h5 className="text-primary-foreground font-bold mb-4">Contact</h5>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <Mail size={16} className="text-primary shrink-0" />
                  hello@tracmedy.com
                </li>
                <li className="flex items-center gap-3">
                  <MapPin size={16} className="text-primary shrink-0" />
                  Lagos, Nigeria
                </li>
              </ul>
            </div>
 
            {/* Social */}
            <div>
              <h5 className="text-primary-foreground font-bold mb-4">Follow Us</h5>
              <div className="flex gap-4">
                <a href="https://www.tiktok.com/@tracmedy?_r=1&_t=ZS-94P788zNzdI" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted-foreground/10 hover:bg-primary/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z"/></svg>
                </a>
                <a href="https://www.linkedin.com/company/tracmedy/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted-foreground/10 hover:bg-primary/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://www.instagram.com/tracmedy?igsh=MXJxMTc3bjNyYTZ3dg%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted-foreground/10 hover:bg-primary/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
          </div>
 
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs uppercase tracking-widest font-bold">
            <p>© 2026 Tracmedy. All rights reserved.</p>
            <div className="flex gap-8">
              <Link
                className="hover:text-primary-foreground transition-colors text-xs uppercase tracking-widest font-bold text-footer-foreground"
                href="/privacy-policy"
              >
                Privacy Policy
              </Link>
              <Link
                className="hover:text-primary-foreground transition-colors text-xs uppercase tracking-widest font-bold text-footer-foreground"
                href="/terms"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
 
    </>
  );
};
 
export default TracmedyFooter;

