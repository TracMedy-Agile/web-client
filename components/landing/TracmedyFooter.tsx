'use client'
import { useState } from "react";
import { Mail, MapPin } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
 
const TracmedyFooter = () => {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
 
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
                <span className="text-xl font-black tracking-tight text-primary-foreground">Tracmedy</span>
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
              <button
                className="hover:text-primary-foreground transition-colors cursor-pointer bg-transparent border-none p-0 text-xs uppercase tracking-widest font-bold text-footer-foreground"
                onClick={() => setPrivacyOpen(true)}
              >
                Privacy Policy
              </button>
              <button
                className="hover:text-primary-foreground transition-colors cursor-pointer bg-transparent border-none p-0 text-xs uppercase tracking-widest font-bold text-footer-foreground"
                onClick={() => setTermsOpen(true)}
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>
 
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Privacy Policy</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[65vh] pr-4">
            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <p className="text-xs text-muted-foreground">Effective Date: February 2026</p>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">1. Introduction</h3>
                <p>Tracmedy (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, including our mobile application and web dashboard.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">2. Information We Collect</h3>
                <p><strong className="text-foreground">Personal Information:</strong> Name, email address, phone number, date of birth, and Health ID when you create an account.</p>
                <p><strong className="text-foreground">Health Data:</strong> Medical records, medication schedules, care episode details, symptom check-in responses, and recovery progress data entered by you or your healthcare provider.</p>
                <p><strong className="text-foreground">Usage Data:</strong> Device information, IP address, browser type, app usage patterns, and interaction logs to improve our services.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">3. How We Use Your Information</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>To provide and maintain structured post-care monitoring services</li>
                  <li>To activate and manage Care Episodes between patients and clinicians</li>
                  <li>To send medication reminders, follow-up prompts, and health check-ins</li>
                  <li>To generate early intervention alerts for healthcare providers</li>
                  <li>To improve platform functionality and user experience</li>
                  <li>To communicate important service updates</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">4. Data Security</h3>
                <p>We use encrypted data transmission (TLS/SSL), secure cloud infrastructure, and role-based access controls. Hospitals can only access data for their own patients. Sensitive identifiers such as QR tokens and Health IDs do not expose raw medical records without proper authentication.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">5. Data Sharing</h3>
                <p>We do not sell your personal or health data. Information is shared only with:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Healthcare providers linked to your Care Episodes</li>
                  <li>Service providers who assist in operating our platform (under strict confidentiality agreements)</li>
                  <li>Legal authorities when required by applicable law</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">6. Your Rights</h3>
                <p>You have the right to access, update, or request deletion of your personal data. You may also withdraw consent for data processing at any time by contacting us at <strong className="text-foreground">hello@tracmedy.com</strong>.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">7. Data Retention</h3>
                <p>We retain your data for as long as your account is active or as needed to provide services. Health data associated with completed Care Episodes may be retained for continuity purposes unless you request deletion.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">8. Children&apos;s Privacy</h3>
                <p>Tracmedy is not intended for use by individuals under the age of 18 without parental or guardian consent. We do not knowingly collect data from minors without appropriate authorization.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">9. Changes to This Policy</h3>
                <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date. Continued use of Tracmedy after changes constitutes acceptance of the revised policy.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">10. Contact Us</h3>
                <p>If you have questions about this Privacy Policy, please contact us at:</p>
                <p><strong className="text-foreground">Email:</strong> hello@tracmedy.com</p>
                <p><strong className="text-foreground">Location:</strong> Lagos, Nigeria</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
 
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Terms of Service</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[65vh] pr-4">
            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <p className="text-xs text-muted-foreground">Effective Date: February 2026</p>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h3>
                <p>By accessing or using Tracmedy (&apos;the Platform&apos;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform. Continued use constitutes acceptance of any updates or modifications to these terms.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">2. Description of Service</h3>
                <p>Tracmedy is a post-discharge healthcare continuity platform that connects patients and healthcare providers through structured monitoring, medication reminders, symptom check-ins, and early intervention alerts. Tracmedy does not provide medical advice, diagnoses, or treatment. It is a support tool designed to enhance care coordination after hospital visits.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">3. User Accounts</h3>
                <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify us immediately if you suspect unauthorized access.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">4. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Use the Platform only for its intended purpose of healthcare continuity and recovery monitoring</li>
                  <li>Provide truthful health information during check-ins and interactions</li>
                  <li>Do not share your account credentials with others</li>
                  <li>Do not attempt to reverse-engineer, disrupt, or misuse the Platform</li>
                  <li>Comply with all applicable laws and regulations</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">5. Healthcare Disclaimer</h3>
                <p>Tracmedy is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified healthcare provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay seeking it because of information provided through Tracmedy.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">6. Intellectual Property</h3>
                <p>All content, features, and functionality of the Platform — including text, graphics, logos, icons, and software — are the property of Tracmedy and are protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">7. Limitation of Liability</h3>
                <p>To the maximum extent permitted by law, Tracmedy shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the amount you paid (if any) for using the service.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">8. Termination</h3>
                <p>We reserve the right to suspend or terminate your account at our discretion if you violate these Terms of Service or engage in conduct that is harmful to other users, healthcare providers, or the Platform. You may also delete your account at any time by contacting us.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">9. Changes to Terms</h3>
                <p>We may modify these Terms of Service at any time. Updated terms will be posted on this page with a revised effective date. Your continued use of Tracmedy after changes are posted constitutes acceptance of the updated terms.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">10. Governing Law</h3>
                <p>These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to conflict of law principles.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">11. Contact Us</h3>
                <p>If you have questions about these Terms of Service, please contact us at:</p>
                <p><strong className="text-foreground">Email:</strong> hello@tracmedy.com</p>
                <p><strong className="text-foreground">Location:</strong> Lagos, Nigeria</p>
              </section>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
 
export default TracmedyFooter;