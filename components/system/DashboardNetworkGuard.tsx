"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import NetworkErrorState from "@/components/system/NetworkErrorState";

function subscribeToConnection(callback: () => void) {
  window.addEventListener("offline", callback);
  window.addEventListener("online", callback);
  return () => {
    window.removeEventListener("offline", callback);
    window.removeEventListener("online", callback);
  };
}

function getConnectionSnapshot() {
  return navigator.onLine;
}

function getServerConnectionSnapshot() {
  return true;
}

export default function DashboardNetworkGuard({ children }: { children: ReactNode }) {
  const isOnline = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot,
  );

  if (!isOnline) {
    return <NetworkErrorState />;
  }

  return children;
}
