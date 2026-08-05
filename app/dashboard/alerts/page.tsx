import { Suspense } from "react";
import AlertsScreen from "./components/AlertsScreen";

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
      <AlertsScreen />
    </Suspense>
  );
}
