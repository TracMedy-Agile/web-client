"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PatientConnection,
  PatientProfileDetail,
  UpdateConnectedPatientInput,
} from "@/lib/api/connected-patients";

type Props = {
  open: boolean;
  patient: PatientProfileDetail;
  connection: PatientConnection;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateConnectedPatientInput) => Promise<void>;
};

const fieldClass = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export function EditConnectedPatientDialog({ open, patient, connection, onOpenChange, onSave }: Props) {
  const [values, setValues] = useState<UpdateConnectedPatientInput>(() => ({
    email: patient.email,
    phone: patient.phone,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    externalPatientId: connection.externalPatientId,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof UpdateConnectedPatientInput, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await onSave(values);
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update patient.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit patient information</DialogTitle>
          <DialogDescription>Update the hospital record for {patient.name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold">Hospital ID<input className={fieldClass} value={values.externalPatientId ?? ""} onChange={(e) => setField("externalPatientId", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Date of birth<input type="date" className={fieldClass} value={(values.dateOfBirth ?? "").slice(0, 10)} onChange={(e) => setField("dateOfBirth", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Phone<input className={fieldClass} value={values.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Email<input type="email" className={fieldClass} value={values.email ?? ""} onChange={(e) => setField("email", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Gender<input className={fieldClass} value={values.gender ?? ""} onChange={(e) => setField("gender", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Blood group<input className={fieldClass} value={values.bloodGroup ?? ""} onChange={(e) => setField("bloodGroup", e.target.value)} /></label>
          </div>
          {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
