import type { Metadata } from "next";
import { Toaster } from "sonner";
import { PostHogProvider } from "@/app/(landing)/components/posthog-provider";
import { PostHogPageView } from "@/app/components/PostHogPageView";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tracmedy.com"),
  title: "Tracmedy",
  description: "Bridging the gap between hospital care and patient recovery through real-time post-discharge monitoring.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Tracmedy â€” Healthcare Continuity for Africa",
    description: "Bridging the gap between hospital care and patient recovery through real-time post-discharge monitoring.",
    url: "https://tracmedy.com",
    siteName: "Tracmedy",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <PostHogPageView />
          {children}
        </PostHogProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}