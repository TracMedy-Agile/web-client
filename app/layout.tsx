import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracmedy",
  description: "Bridging the gap between hospital care and patient recovery through real-time post-discharge monitoring.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}