"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Bell, CalendarDays, History, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MedicationSection } from "./components/MedicationSection";
import { LabTestsSection } from "./components/LabTestsSection";
import { HomeCareSection } from "./components/HomeCareSection";
import { LifestyleSection } from "./components/LifestyleSection";
import { WarningSignsSection } from "./components/WarningSignsSection";
import { fieldClass, FieldLabel, SectionFrame } from "./components/SectionFrame";
import { MonitoringScheduleSection } from "./components/MonitoringScheduleSection";
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
  const { form, setForm, versions, clinicians, services, patient, error, isLoading, saveMode, isDirty, save, reset } = useCarePlanForm(episodeId);
  const [modalMode, setModalMode] = useState<"patch" | "post" | null>(null);
  const endDate = useMemo(() => projectedDate(form.startDate, form.episodeDuration), [form.startDate, form.episodeDuration]);
  // The backend always auto-creates a stub v1 care plan when the episode opens, so `versions`
  // is never empty — the real "first save" signal is that only that untouched stub exists.
  const isFirstCarePlanSetup = !form.id || (versions.length <= 1 && form.version <= 1);

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
    <div className="mx-auto max-w-[1128px] pb-8">
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_362px]">
        <div className="space-y-4">
          <MedicationSection items={form.medications} onChange={(items) => updateForm("medications", items)} />
          <LabTestsSection items={form.labTests} onChange={(items) => updateForm("labTests", items)} />
          <MonitoringScheduleSection items={form.monitoring} onChange={(items) => updateForm("monitoring", items)} />
          <HomeCareSection items={form.homeCare} clinicians={clinicians} services={services} onChange={(items) => updateForm("homeCare", items)} />
          <LifestyleSection items={form.lifestyle} onChange={(items) => updateForm("lifestyle", items)} />
          <WarningSignsSection items={form.warningSigns} onChange={(items) => updateForm("warningSigns", items)} />
          <SectionFrame icon={<CalendarDays className="h-4 w-4" />} title="Episode Duration" subtitle="Extend or shorten the active episode">
            <div className="grid gap-4 sm:grid-cols-3"><label><FieldLabel>Total duration (days)</FieldLabel><input type="number" min={1} className={fieldClass} value={form.episodeDuration} onChange={(event) => updateForm("episodeDuration", Number(event.target.value))} /></label><label><FieldLabel>Start date</FieldLabel><input type="date" className={fieldClass} value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label><label><FieldLabel>Projected end date</FieldLabel><input type="date" className={`${fieldClass} bg-muted/40`} readOnly value={endDate} /></label></div>
          </SectionFrame>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="text-base font-bold text-foreground">Plan summary</h2><dl className="mt-4 text-[11px] text-muted-foreground">{[["Medications", form.medications.length], ["Lab & diagnostic tests", form.labTests.length], ["Home care orders", form.homeCare.length], ["Monitoring schedule", form.monitoring.length], ["Warning signs", form.warningSigns.length], ["Lifestyle recommendations", form.lifestyle.length]].map(([label, count]) => <div key={String(label)} className="flex justify-between border-b border-border py-2.5 first:pt-0"><dt>{label}</dt><dd className="font-bold text-foreground">{count}</dd></div>)}<div className="flex justify-between pt-3"><dt>Duration</dt><dd className="font-bold text-foreground">{form.episodeDuration} days</dd></div></dl></CardContent></Card>
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 text-base font-bold text-foreground"><History className="h-4 w-4 text-primary" />Version history</h2><div className="mt-5 max-h-80 space-y-3 overflow-y-auto">{versions.map((item) => <div key={item.id} className={item.isActive ? "rounded-xl border border-primary/50 bg-primary/10 p-4" : "rounded-xl border border-border p-4"}><div className="flex items-center justify-between"><strong className="text-xs text-foreground">Version {item.version}.0</strong>{item.isActive ? <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-600">ACTIVE</span> : null}</div><p className="mt-3 text-[10px] leading-4 text-muted-foreground">{item.changeReason || "Care plan updated."}</p><p className="mt-3 text-right text-[9px] font-bold uppercase text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable"}</p></div>)}</div></CardContent></Card>
          <Card className="rounded-xl border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Bell className="h-4 w-4 text-primary" />Patient notification</h2><p className="mt-3 text-[10px] leading-4 text-muted-foreground">The backend automatically notifies the patient after the care plan is saved.</p></CardContent></Card>
        </aside>
      </div>

      <SaveConfirmationModal isOpen={Boolean(modalMode)} onClose={() => setModalMode(null)} onConfirm={(reason) => save(modalMode ?? "patch", reason)} currentVersion={form.version} nextVersion={modalMode === "post" ? form.version + 1 : form.version} patientName={patient.name} createsVersion={modalMode === "post"} requiresReason={!isFirstCarePlanSetup} />
    </div>
  );
}
