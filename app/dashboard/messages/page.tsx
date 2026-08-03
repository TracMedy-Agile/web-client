import { Suspense } from "react";
import { MessagesScreen } from "./components/MessagesScreen";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-7rem)] animate-pulse rounded-xl bg-muted" />}>
      <MessagesScreen />
    </Suspense>
  );
}
