"use client";

import { useLayoutEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, FileText, Image as ImageIcon, X, ZoomIn, ZoomOut } from "lucide-react";
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
  imageUrl?: string;
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
  Reviewed: "bg-[#DFFBF0] text-[#10B981]",
  "Pending review": "bg-[#FFF4E5] text-[#F59E0B]",
};

function downloadPlaceholderImage(media: MediaViewerData) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(media.title, canvas.width / 2, canvas.height / 2 - 16);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText(media.captureContext, canvas.width / 2, canvas.height / 2 + 16);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${media.title.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function downloadMedia(media: MediaViewerData) {
  if (!media.imageUrl) {
    downloadPlaceholderImage(media);
    return;
  }
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
    }
  }, [open, media]);

  if (!media) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:inset-8">
          <DialogPrimitive.Title className="sr-only">{media.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Clinical media viewer for {media.title}</DialogPrimitive.Description>

          <div className="flex items-center justify-end gap-1 border-b border-[#E5E7EB] px-4 py-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#71809B] hover:bg-[#F3F4F6] disabled:opacity-40"
            >
              <ZoomOut className="h-4.5 w-4.5" />
            </button>
            <span className="w-14 text-center text-sm font-bold text-[#111827]">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#71809B] hover:bg-[#F3F4F6] disabled:opacity-40"
            >
              <ZoomIn className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => downloadMedia(media)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#71809B] hover:bg-[#F3F4F6]"
            >
              <Download className="h-4.5 w-4.5" />
            </button>
            <span className="mx-1 h-6 w-px bg-[#E5E7EB]" />
            <DialogPrimitive.Close className="flex h-9 w-9 items-center justify-center rounded-lg text-[#71809B] hover:bg-[#F3F4F6]">
              <X className="h-4.5 w-4.5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0F172A] p-8">
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#111827]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#023E8A]" />
                CURRENT: {media.currentLabel.toUpperCase()}
              </span>
              <div
                className="flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-[#3B2A24] via-[#8A5A45] to-[#C89B7B] shadow-xl transition-transform duration-150"
                style={{ transform: `scale(${zoom / 100})` }}
              >
                {media.imageUrl && media.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.imageUrl} alt={media.title} className="h-full w-full object-contain" />
                ) : media.kind === "pdf" ? (
                  <FileText className="h-16 w-16 text-white/70" />
                ) : (
                  <ImageIcon className="h-16 w-16 text-white/50" />
                )}
              </div>
            </div>

            <div className="w-full shrink-0 overflow-y-auto border-t border-[#E5E7EB] bg-white p-6 lg:w-90 lg:border-l lg:border-t-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#111827]">{media.title}</h2>
                <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_BADGE[media.status])}>
                  {media.status}
                </span>
              </div>
              {media.priority ? (
                <span className="mt-2 inline-flex rounded-full bg-[#FFECEC] px-2.5 py-0.5 text-xs font-bold uppercase text-[#EF4444]">
                  {media.priority}
                </span>
              ) : null}

              <dl className="mt-5 space-y-3 border-t border-[#E5E7EB] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Capture Context</dt>
                  <dd className="text-sm font-bold text-[#111827]">{media.captureContext}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Date Captured</dt>
                  <dd className="text-sm font-bold text-[#111827]">{media.dateCaptured}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Upload Timestamp</dt>
                  <dd className="text-sm font-bold text-[#111827]">{media.uploadTimestamp}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Patient ID</dt>
                  <dd className="text-sm font-bold text-[#023E8A]">{media.patientId}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-lg border border-[#E5E7EB] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.04em] text-[#023E8A]">
                  <FileText className="h-3.5 w-3.5" />
                  Patient Description
                </p>
                <div className="rounded-lg bg-[#EFF5FF] p-3">
                  <p className="text-sm font-medium italic text-[#344054]">{media.patientDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
