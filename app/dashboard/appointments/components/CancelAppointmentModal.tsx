"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

type CancelAppointmentModalProps = {
  isOpen: boolean;
  appointmentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return typeof accessToken === "string" ? accessToken : null;
  } catch {
    return null;
  }
}

async function cancelAppointmentRequest(appointmentId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ reason: "Cancelled by hospital staff" }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Failed to cancel appointment.");
  }

  return payload;
}

export default function CancelAppointmentModal({
  isOpen,
  appointmentId,
  onClose,
  onSuccess,
}: CancelAppointmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (isSubmitting) return;
    setError("");
    onClose();
  };

  const handleCancel = async () => {
    if (!appointmentId || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      await cancelAppointmentRequest(appointmentId);
      onSuccess?.();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to cancel appointment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/65 px-4 py-4 sm:py-8 backdrop-blur-[4px] duration-150 animate-in fade-in-0">
      <div className="w-full max-w-[516px] rounded-xl bg-white px-4 sm:px-8 py-4 sm:py-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.38)] duration-150 animate-in fade-in-0 zoom-in-95 sm:px-12">
        <div className="flex justify-center">
          <AlertTriangle className="h-16 w-16 text-[#EF4444]" strokeWidth={2.2} />
        </div>

        <h2 className="mt-5 text-lg font-bold md:text-xl text-[#111827]">Cancel Appointment?</h2>

        <div className="mx-auto mt-6 flex max-w-[430px] items-start justify-center gap-3 text-center">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
          <p className="text-sm font-medium leading-5 text-[#71809B]">
            This will cancel the patient&apos;s appointment and notify them
            <br className="hidden sm:block" />
            of the change.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl border border-[#98A2B3] bg-white px-4 sm:px-6 text-sm font-bold text-[#71809B] transition-colors duration-150 hover:bg-[#F8FAFC] hover:text-[#344054] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            No, keep it.
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting || !appointmentId}
            className="h-12 w-full rounded-xl bg-[#EF4444] px-4 sm:px-6 text-sm font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#DC2626] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? "Cancelling..." : "Yes, Cancel!"}
          </button>
        </div>
      </div>
    </div>
  );
}


