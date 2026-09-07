"use client";

import { Suspense, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

const DEEP_LINK_SCHEME = "tracmedy://";

function buildDeepLink(path: string) {
  return `${DEEP_LINK_SCHEME}${path.replace(/^\/+/, "")}`;
}

function OpenPageContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path") ?? "";

  function launchApp() {
    if (!path) return;
    window.location.href = buildDeepLink(path);
  }

  useEffect(() => {
    // Attempt the deep link automatically on load. If the app isn't installed, the
    // browser silently stays on this page (or shows its own native prompt), so the
    // fallback card below remains reachable either way.
    launchApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F5F8FF] px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Image src="/tracmedy_logo.svg" alt="Tracmedy" width={40} height={40} />
        </div>

        <h1 className="mt-6 text-xl font-bold text-gray-900">Continue in the Tracmedy App</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {path
            ? "If the app didn't open automatically, tap the button below."
            : "This link is missing a destination. Open the Tracmedy app directly instead."}
        </p>

        <button
          type="button"
          onClick={launchApp}
          disabled={!path}
          className="mt-8 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open in Tracmedy App
        </button>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium text-gray-400">Don&apos;t have the app?</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* TODO: point these at the real App Store / Play Store listings once published —
              placeholders for now, matching the existing landing page's store badges. */}
          <a href="#" className="block">
            <Image
              src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
              alt="Download on the App Store"
              width={132}
              height={44}
              unoptimized
            />
          </a>
          <a href="#" className="block">
            <Image
              src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
              alt="Get it on Google Play"
              width={148}
              height={44}
              unoptimized
            />
          </a>
        </div>
      </div>
    </main>
  );
}

export default function OpenPage() {
  return (
    <Suspense fallback={null}>
      <OpenPageContent />
    </Suspense>
  );
}
