"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { CircleAlert, Loader2, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DisconnectPatientDialogProps = {
  open: boolean;
  patientName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
};

export function DisconnectPatientDialog({
  open,
  patientName,
  onOpenChange,
  onConfirm,
}: DisconnectPatientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background px-5 py-8 shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:px-10 sm:py-10">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-destructive">
              <TriangleAlert className="h-11 w-11 stroke-[1.8]" aria-hidden="true" />
            </span>

            <AlertDialogPrimitive.Title className="mt-6 text-xl font-extrabold tracking-[0.02em] text-foreground sm:text-2xl">
              DISCONNECT PATIENT?
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Are you sure you want to disconnect <strong className="font-bold text-foreground">{patientName}</strong>?
            </AlertDialogPrimitive.Description>

            <div className="mt-7 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-5 text-left sm:px-6">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h2>WHAT HAPPENS AFTER DISCONNECTING</h2>
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950/80">
                <li>Patient is removed from the Connected Patients list.</li>
                <li>Real-time syncing and monitoring with this patient stop.</li>
                <li>A new connection code is required to reconnect.</li>
              </ul>
            </div>

            {error ? <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}

            <div className="mt-8 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <AlertDialogPrimitive.Cancel
                disabled={isSubmitting}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-lg px-7 font-bold sm:min-w-44",
                )}
              >
                Keep Connected
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                className={cn(
                  buttonVariants({ variant: "destructive", size: "lg" }),
                  "h-12 rounded-lg px-7 font-bold sm:min-w-44",
                )}
                disabled={isSubmitting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirm();
                }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Disconnecting..." : "Disconnect Patient"}
              </AlertDialogPrimitive.Action>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
