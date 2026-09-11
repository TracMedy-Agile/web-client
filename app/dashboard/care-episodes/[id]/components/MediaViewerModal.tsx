"use client";

import { useLayoutEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, FileText, Image as ImageIcon, X, ZoomIn, ZoomOut } from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

export type MediaViewerData = {
  title: string;
  status: "Reviewed" | "Pending review";
  priority: string | null;
  kind: "image" | "pdf";
  captureContext: string;
  dateCaptured: string;
  currentLabel: string;
  uploadTimestamp: string;
  patientId: string;
  patientDescription: string;
  imageUrl: string;
};

type MediaViewerModalProps = {
  open: boolean;
  media: MediaViewerData | null;
  onOpenChange: (open: boolean) => void;
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

const STATUS_BADGE: Record<MediaViewerData["status"], string> = {
  Reviewed: "bg-emerald-50 text-emerald-500",
  "Pending review": "bg-amber-50 text-amber-500",
};


function downloadMedia(media: MediaViewerData) {
  const link = document.createElement("a");
  link.href = media.imageUrl;
  link.download = `${media.title.replace(/\s+/g, "-").toLowerCase()}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
}

export function MediaViewerModal({ open, media, onOpenChange }: MediaViewerModalProps) {
  const [zoom, setZoom] = useState(100);

  useLayoutEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setZoom(100);
      capturePostHogEvent("clinical_media_viewed", { media_title: media?.title });
    }
  }, [open, media]);

  if (!media) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[1180px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">{media.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Clinical media viewer for {media.title}</DialogPrimitive.Description>

          <div className="flex items-center justify-end gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              aria-label="Zoom out"
              disabled={zoom <= MIN_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <ZoomOut className="h-4.5 w-4.5" />
            </button>
            <span className="w-14 text-center text-sm font-bold text-slate-900">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              aria-label="Zoom in"
              disabled={zoom >= MAX_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <ZoomIn className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                capturePostHogEvent("clinical_media_downloaded", { media_title: media.title });
                downloadMedia(media);
              }}
              aria-label="Download clinical media"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <Download className="h-4.5 w-4.5" />
            </button>
            <span className="mx-1 h-6 w-px bg-slate-200" />
            <DialogPrimitive.Close aria-label="Close clinical media viewer" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="h-4.5 w-4.5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-blue-50 p-5 lg:flex-row">
            <div className="relative flex min-h-96 flex-1 items-center justify-center overflow-auto rounded-xl bg-slate-900 p-6">
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                CURRENT: {media.currentLabel.toUpperCase()}
              </span>
              <div
                className="flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 shadow-xl transition-transform duration-150"
                style={{ transform: `scale(${zoom / 100})` }}
              >
                {media.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.imageUrl} alt={media.title} className="h-full w-full object-contain" />
                ) : media.kind === "pdf" ? (
                  <iframe src={media.imageUrl} title={media.title} className="h-full w-full rounded-lg border-0 bg-white" />
                ) : (
                  <ImageIcon className="h-16 w-16 text-white/50" />
                )}
              </div>
            </div>

            <div className="w-full shrink-0 space-y-5 lg:w-90">
              <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{media.title}</h2>
                <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold", STATUS_BADGE[media.status])}>
                  {media.status}
                </span>
              </div>
              {media.priority ? (
                <span className="mt-2 inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold uppercase text-red-500">
                  {media.priority}
                </span>
              ) : null}

              <dl className="mt-5 space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">Capture Context</dt>
                  <dd className="text-right text-xs font-bold text-slate-900">{media.captureContext}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">Date Captured</dt>
                  <dd className="text-right text-xs font-bold text-slate-900">{media.dateCaptured}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">Upload Timestamp</dt>
                  <dd className="text-right text-xs font-bold text-slate-900">{media.uploadTimestamp}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">Patient ID</dt>
                  <dd className="text-right text-xs font-bold text-primary">{media.patientId}</dd>
                </div>
              </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.04em] text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  Patient Description
                </p>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm font-medium italic text-slate-700">{media.patientDescription}</p>
                </div>
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
