"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, LoaderCircle } from "lucide-react";

export default function SendInstructionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  useEffect(() => {
    if (episodeId) router.replace(`/dashboard/messages?${new URLSearchParams({ episodeId })}`);
  }, [episodeId, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-primary">
      <LoaderCircle className="h-7 w-7 animate-spin" aria-label="Opening messages" />
      <Link
        href={episodeId ? `/dashboard/care-episodes/${episodeId}` : "/dashboard/care-episodes"}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Care Episode
      </Link>
    </div>
  );
}
