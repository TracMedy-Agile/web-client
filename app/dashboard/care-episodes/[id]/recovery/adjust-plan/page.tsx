"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Activity, AlertCircle, ArrowLeft, Bell, CalendarDays, History, Loader2,
  Save, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { MedicationSection } from "./components/MedicationSection";
import { LabTestsSection } from "./components/LabTestsSection";
import { HomeCareSection } from "./components/HomeCareSection";
import { LifestyleSection } from "./components/LifestyleSection";
import { WarningSignsSection } from "./components/WarningSignsSection";
import { ChangeJustification } from "./components/ChangeJustification";
import { AddRowButton, DeleteDialog, fieldClass, FieldLabel, SectionFrame } from "./components/SectionFrame";
import { SaveConfirmationModal } from "./components/SaveConfirmationModal";
import { useCarePlanForm } from "./hooks/useCarePlanForm";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

function projectedDate(startDate: string, days: number) {
  if (!startDate || days < 1) return "";
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days - 1);
  return date.toISOString().slice(0, 10);
}

function PageSkeleton() {
  return <div className="mx-auto max-w-[1080px] space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-64 w-full rounded-xl" />)}</div><div className="space-y-4"><Skeleton className="h-60 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div></div></div>;
}

export default function AdjustCarePlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";
  const { form, setForm, clinicians, patient, error, isLoading, saveMode, isDirty, save, reset } = useCarePlanForm(episodeId);
  const [deletingMonitoringId, setDeletingMonitoringId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"patch" | "post" | null>(null);
  const endDate = useMemo(() => projectedDate(form.startDate, form.episodeDuration), [form.startDate, form.episodeDuration]);

  useEffect(() => {
    if (episodeId) capturePostHogEvent("care_plan_adjust_viewed", { episode_id: episodeId });
  }, [episodeId]);

  if (isLoading) return <PageSkeleton />;

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  function openSave(mode: "patch" | "post") {
    if (error) { toast.error("The active care plan must load before it can be changed."); return; }
    if (form.medications.some((medication) => !medication.name.trim() || !medication.dosage.trim() || !medication.frequency.trim() || !medication.duration.trim())) {
      toast.error("Complete all required medication fields before saving."); return;
    }
    if (!form.startDate || form.episodeDuration < 1) { toast.error("Episode start date and duration are required."); return; }
    capturePostHogEvent("care_plan_save_opened", { episode_id: episodeId, mode });
    setModalMode(mode);
  }

  function cancel() {
    const leave = () => {
      reset();
      router.push(`/dashboard/care-episodes/${episodeId}/recovery`);
    };

    if (!isDirty) {
      leave();
      return;
    }

    toast.warning("Unsaved care plan changes", {
      id: "discard-adjust-care-plan",
      description: "Your edits have not been saved.",
      duration: 8000,
      action: {
        label: "Discard and leave",
        onClick: leave,
      },
    });
  }

  return (
    <div className="mx-auto max-w-[1080px] pb-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={cancel} className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-foreground">Adjust Care Plan</h1><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase text-primary">V{form.version} {form.isActive ? "Active" : "Inactive"}</span></div>
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">Review and Adjust Care Plan for <strong className="text-muted-foreground">{patient.name} ({patient.id})</strong></p>
        </div>
        <div className="flex items-center justify-end gap-3"><Button type="button" variant="ghost" onClick={cancel} className="h-10 text-xs font-bold text-foreground">Cancel</Button><Button type="button" onClick={() => openSave("post")} disabled={Boolean(saveMode)} className="h-10 bg-primary px-5 text-xs font-bold text-white hover:bg-primary/90"><Save className="h-4 w-4" />Save changes</Button></div>
      </div>

      {error ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-bold">Care plan unavailable</p><p className="mt-1 text-destructive/80">{error} Editing and saving are disabled until this data is available.</p></div>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <MedicationSection items={form.medications} onChange={(items) => updateForm("medications", items)} />
          <LabTestsSection items={form.labTests} onChange={(items) => updateForm("labTests", items)} />
          <SectionFrame icon={<Activity className="h-4 w-4" />} title="Monitoring Schedule" subtitle="Check-ins and vitals frequency">
            <div className="space-y-3">{form.monitoring.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl bg-muted/60 p-3 sm:grid-cols-[1fr_150px_100px_auto]"><input aria-label="Monitoring item" className={fieldClass} value={item.name} onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, name: event.target.value } : current))} /><input aria-label="Monitoring frequency" className={fieldClass} value={item.frequency} onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, frequency: event.target.value } : current))} /><input aria-label="Monitoring cadence" className={fieldClass} value={item.cadence} placeholder="Cadence" onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, cadence: event.target.value } : current))} /><button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeletingMonitoringId(item.id)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400"><Trash2 className="h-4 w-4" /></button></div>)}</div>
            <AddRowButton onClick={() => updateForm("monitoring", [...form.monitoring, {
              id: crypto.randomUUID(),
              name: "",
              frequency: "",
              cadence: "",
            }])}>Add monitoring item</AddRowButton>
          </SectionFrame>
          <HomeCareSection items={form.homeCare} clinicians={clinicians} onChange={(items) => updateForm("homeCare", items)} />
          <LifestyleSection items={form.lifestyle} onChange={(items) => updateForm("lifestyle", items)} />
          <WarningSignsSection items={form.warningSigns} onChange={(items) => updateForm("warningSigns", items)} />
          <SectionFrame icon={<CalendarDays className="h-4 w-4" />} title="Episode Duration" subtitle="Extend or shorten the active episode">
            <div className="grid gap-4 sm:grid-cols-3"><label><FieldLabel>Total duration (days)</FieldLabel><input type="number" min={1} className={fieldClass} value={form.episodeDuration} onChange={(event) => updateForm("episodeDuration", Number(event.target.value))} /></label><label><FieldLabel>Start date</FieldLabel><input type="date" className={fieldClass} value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label><label><FieldLabel>Projected end date</FieldLabel><input type="date" className={`${fieldClass} bg-muted/40`} readOnly value={endDate} /></label></div>
          </SectionFrame>
          <ChangeJustification selected={form.changeReasons} details={form.additionalReason} onSelectedChange={(value) => updateForm("changeReasons", value)} onDetailsChange={(value) => updateForm("additionalReason", value)} />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={cancel}>Cancel</Button><Button type="button" onClick={() => openSave("post")} className="bg-primary text-white">{saveMode === "post" ? <Loader2 className="animate-spin" /> : <Save />}Save Changes</Button></div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="text-sm font-bold text-foreground">Plan summary</h2><dl className="mt-4 space-y-3 text-[10px] text-muted-foreground">{[["Medications", form.medications.length], ["Lab & diagnostic tests", form.labTests.length], ["Home care orders", form.homeCare.length], ["Monitoring schedule", form.monitoring.length], ["Warning signs", form.warningSigns.length], ["Lifestyle recommendations", form.lifestyle.length]].map(([label, count]) => <div key={String(label)} className="flex justify-between"><dt>{label}</dt><dd className="font-bold text-foreground">{count}</dd></div>)}<div className="flex justify-between"><dt>Duration</dt><dd className="font-bold text-foreground">{form.episodeDuration} days</dd></div></dl></CardContent></Card>
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><History className="h-4 w-4 text-primary" />Version history</h2><div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3"><div className="flex items-center justify-between"><strong className="text-[11px] text-foreground">Version {form.version}.0</strong><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">{form.isActive ? "ACTIVE" : "INACTIVE"}</span></div><p className="mt-2 text-[9px] leading-4 text-muted-foreground">Current plan returned by the care-plan API.</p><p className="mt-2 text-right text-[8px] font-bold text-muted-foreground">{form.createdAt ? new Date(form.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable"}</p></div><p className="mt-3 text-[9px] leading-4 text-muted-foreground">Prior versions are not exposed by the current API.</p></CardContent></Card>
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Bell className="h-4 w-4 text-primary" />Patient notification</h2><Switch checked={false} disabled aria-describedby="notification-unavailable" /></div><p id="notification-unavailable" className="mt-3 text-[9px] leading-4 text-muted-foreground">Patient notifications are not available in the current care-plan API. Saving will not send a notification.</p></CardContent></Card>
        </aside>
      </div>

      <DeleteDialog label="monitoring item" open={Boolean(deletingMonitoringId)} onOpenChange={(open) => { if (!open) setDeletingMonitoringId(null); }} onConfirm={() => { updateForm("monitoring", form.monitoring.filter((item) => item.id !== deletingMonitoringId)); setDeletingMonitoringId(null); }} />
      <SaveConfirmationModal isOpen={Boolean(modalMode)} onClose={() => setModalMode(null)} onConfirm={(reason) => save(modalMode ?? "patch", reason)} currentVersion={form.version} nextVersion={modalMode === "post" ? form.version + 1 : form.version} patientName={patient.name} createsVersion={modalMode === "post"} />
    </div>
  );
}
