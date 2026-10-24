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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
] as const;

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

// UpdateFacilityPatientDto limits for free-text fields (gender/blood group are fixed options).
const MAX_LENGTH = { externalPatientId: 50, phone: 30 } as const;

type FormValues = {
  externalPatientId: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  gender: string;
  bloodGroup: string;
};

function normalizeGender(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return GENDER_OPTIONS.some((option) => option.value === normalized) ? normalized : "";
}

function normalizeBloodGroup(value: string) {
  const normalized = value.trim().toUpperCase();
  return BLOOD_GROUP_OPTIONS.some((option) => option === normalized) ? normalized : "";
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// PATCH semantics: send only fields that changed. Email and date of birth are validated
// (IsEmail / IsDate) and cannot be sent blank; the other text fields may be cleared.
function buildUpdate(initial: FormValues, values: FormValues): { input: UpdateConnectedPatientInput; error: string } {
  const input: UpdateConnectedPatientInput = {};
  const changed = (field: keyof FormValues) => values[field].trim() !== initial[field].trim();

  if (changed("email")) {
    if (!values.email.trim()) return { input, error: "Email can't be blank. Enter a valid email address." };
    input.email = values.email.trim();
  }
  if (changed("dateOfBirth")) {
    if (!values.dateOfBirth) return { input, error: "Date of birth can't be blank." };
    if (values.dateOfBirth > todayIso()) return { input, error: "Date of birth can't be in the future." };
    input.dateOfBirth = values.dateOfBirth;
  }
  if (changed("externalPatientId")) input.externalPatientId = values.externalPatientId.trim();
  if (changed("phone")) input.phone = values.phone.trim();
  if (changed("gender")) input.gender = values.gender;
  if (changed("bloodGroup")) input.bloodGroup = values.bloodGroup;
  return { input, error: "" };
}

export function EditConnectedPatientDialog({ open, patient, connection, onOpenChange, onSave }: Props) {
  const [initialValues] = useState<FormValues>(() => ({
    externalPatientId: connection.externalPatientId,
    dateOfBirth: patient.dateOfBirth.slice(0, 10),
    phone: patient.phone,
    email: patient.email,
    gender: normalizeGender(patient.gender),
    bloodGroup: normalizeBloodGroup(patient.bloodGroup),
  }));
  const [values, setValues] = useState<FormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { input, error: validationError } = buildUpdate(initialValues, values);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (Object.keys(input).length === 0) {
      onOpenChange(false);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave(input);
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
            <label className="space-y-2 text-sm font-semibold">Hospital ID<input className={fieldClass} maxLength={MAX_LENGTH.externalPatientId} value={values.externalPatientId} onChange={(e) => setField("externalPatientId", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Date of birth<input type="date" className={fieldClass} max={todayIso()} value={values.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Phone<input type="tel" className={fieldClass} maxLength={MAX_LENGTH.phone} value={values.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">Email<input type="email" className={fieldClass} value={values.email} onChange={(e) => setField("email", e.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold">
              Gender
              <Select value={values.gender} onValueChange={(value) => setField("gender", value)}>
                <SelectTrigger className="h-11 rounded-lg border-border bg-background" aria-label="Gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-semibold">
              Blood group
              <Select value={values.bloodGroup} onValueChange={(value) => setField("bloodGroup", value)}>
                <SelectTrigger className="h-11 rounded-lg border-border bg-background" aria-label="Blood group">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
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
