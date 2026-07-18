"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Activity, ArrowLeft, Bell, CalendarDays, History, Loader2,
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
import { AddTaskModal } from "./components/AddTaskModal";
import { AddRowButton, DeleteDialog, fieldClass, FieldLabel, SectionFrame } from "./components/SectionFrame";
import { SaveConfirmationModal } from "./components/SaveConfirmationModal";
import { useCarePlanForm } from "./hooks/useCarePlanForm";

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
  const { form, setForm, clinicians, patient, isLoading, saveMode, isDirty, save, reset } = useCarePlanForm(episodeId);
  const [addingMonitoring, setAddingMonitoring] = useState(false);
  const [deletingMonitoringId, setDeletingMonitoringId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"patch" | "post" | null>(null);
  const endDate = useMemo(() => projectedDate(form.startDate, form.episodeDuration), [form.startDate, form.episodeDuration]);

  if (isLoading) return <PageSkeleton />;

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  function openSave(mode: "patch" | "post") {
    if (!form.medications.length || form.medications.some((medication) => !medication.name.trim() || !medication.dosage.trim() || !medication.frequency.trim() || !medication.duration.trim())) {
      toast.error("Complete all required medication fields before saving."); return;
    }
    if (!form.startDate || form.episodeDuration < 1) { toast.error("Episode start date and duration are required."); return; }
    setModalMode(mode);
  }

  function cancel() {
    if (isDirty && !window.confirm("Discard all unsaved care plan changes?")) return;
    reset();
    router.push(`/dashboard/care-episodes/${episodeId}/recovery`);
  }

  return (
    <div className="mx-auto max-w-[1080px] pb-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={cancel} className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#E9EDF2] text-[#526078] hover:bg-[#DDE3EC]"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-[#172033]">Adjust Care Plan</h1><span className="rounded-full bg-[#E4F0FF] px-2.5 py-1 text-[9px] font-bold uppercase text-[#0753A5]">V{form.version} {form.isActive ? "Active" : "Inactive"}</span></div>
          <p className="mt-1.5 text-[11px] font-medium text-[#8190A5]">Review and Adjust Care Plan for <strong className="text-[#526078]">{patient.name} ({patient.id})</strong></p>
        </div>
        <div className="flex items-center justify-end gap-3"><Button type="button" variant="ghost" onClick={cancel} className="h-10 text-xs font-bold text-[#172033]">Cancel</Button><Button type="button" onClick={() => openSave("patch")} disabled={Boolean(saveMode)} className="h-10 bg-[#0753A5] px-5 text-xs font-bold text-white hover:bg-[#06468B]"><Save className="h-4 w-4" />Save changes</Button></div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <MedicationSection items={form.medications} onChange={(items) => updateForm("medications", items)} />
          <LabTestsSection items={form.labTests} onChange={(items) => updateForm("labTests", items)} />
          <SectionFrame icon={<Activity className="h-4 w-4" />} title="Monitoring Schedule" subtitle="Check-ins and vitals frequency">
            <div className="space-y-3">{form.monitoring.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl bg-[#F1F3F5] p-3 sm:grid-cols-[1fr_150px_100px_auto]"><input aria-label="Monitoring item" className={fieldClass} value={item.name} onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, name: event.target.value } : current))} /><input aria-label="Monitoring frequency" className={fieldClass} value={item.frequency} onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, frequency: event.target.value } : current))} /><input aria-label="Monitoring cadence" className={fieldClass} value={item.cadence} placeholder="Cadence" onChange={(event) => updateForm("monitoring", form.monitoring.map((current, i) => i === index ? { ...current, cadence: event.target.value } : current))} /><button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeletingMonitoringId(item.id)} className="flex h-9 w-9 items-center justify-center justify-self-end text-red-400"><Trash2 className="h-4 w-4" /></button></div>)}</div>
            <AddRowButton onClick={() => setAddingMonitoring(true)}>Add testing recommendation</AddRowButton>
          </SectionFrame>
          <HomeCareSection items={form.homeCare} clinicians={clinicians} onChange={(items) => updateForm("homeCare", items)} />
          <LifestyleSection items={form.lifestyle} onChange={(items) => updateForm("lifestyle", items)} />
          <WarningSignsSection items={form.warningSigns} onChange={(items) => updateForm("warningSigns", items)} />
          <SectionFrame icon={<CalendarDays className="h-4 w-4" />} title="Episode Duration" subtitle="Extend or shorten the active episode">
            <div className="grid gap-4 sm:grid-cols-3"><label><FieldLabel>Total duration (days)</FieldLabel><input type="number" min={1} className={fieldClass} value={form.episodeDuration} onChange={(event) => updateForm("episodeDuration", Number(event.target.value))} /></label><label><FieldLabel>Start date</FieldLabel><input type="date" className={fieldClass} value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} /></label><label><FieldLabel>Projected end date</FieldLabel><input type="date" className={`${fieldClass} bg-[#F8FAFC]`} readOnly value={endDate} /></label></div>
          </SectionFrame>
          <ChangeJustification selected={form.changeReasons} details={form.additionalReason} onSelectedChange={(value) => updateForm("changeReasons", value)} onDetailsChange={(value) => updateForm("additionalReason", value)} />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={cancel}>Cancel</Button><Button type="button" variant="outline" onClick={() => openSave("post")} className="border-[#0753A5] text-[#0753A5]">Create New Version</Button><Button type="button" onClick={() => openSave("patch")} className="bg-[#0753A5] text-white">{saveMode === "patch" ? <Loader2 className="animate-spin" /> : <Save />}Save Changes</Button></div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none"><CardContent className="p-5"><h2 className="text-sm font-bold text-[#172033]">Plan summary</h2><dl className="mt-4 space-y-3 text-[10px] text-[#8190A5]">{[["Medications", form.medications.length], ["Lab & diagnostic tests", form.labTests.length], ["Home care orders", form.homeCare.length], ["Monitoring schedule", form.monitoring.length], ["Warning signs", form.warningSigns.length], ["Lifestyle recommendations", form.lifestyle.length]].map(([label, count]) => <div key={String(label)} className="flex justify-between"><dt>{label}</dt><dd className="font-bold text-[#172033]">{count}</dd></div>)}<div className="flex justify-between"><dt>Duration</dt><dd className="font-bold text-[#172033]">{form.episodeDuration} days</dd></div></dl></CardContent></Card>
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none"><CardContent className="p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-[#172033]"><History className="h-4 w-4 text-[#0873DC]" />Version history</h2><div className="mt-4 space-y-4"><div className="rounded-lg border border-[#4B91E5] bg-[#F3F8FF] p-3"><div className="flex items-center justify-between"><strong className="text-[11px] text-[#172033]">Version {form.version}.0</strong><span className="rounded-full bg-[#DDF8EA] px-2 py-0.5 text-[8px] font-bold text-[#16A76A]">ACTIVE</span></div><p className="mt-2 text-[9px] leading-4 text-[#71819A]">Adjusting for post-appendectomy stability.</p><p className="mt-2 text-right text-[8px] font-bold text-[#71819A]">APR 22, 2026</p></div>{[2, 1].map((version) => <div key={version} className="relative border-l-2 border-[#DDE3EC] pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#AAB4C2]" /><strong className="text-[10px] text-[#526078]">Version {version}.0</strong><p className="mt-1 text-[8px] text-[#8190A5]">{version === 2 ? "Initial discharge protocols added." : "Intake admission profile established."}</p></div>)}</div></CardContent></Card>
          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-[#172033]"><Bell className="h-4 w-4 text-[#0873DC]" />Patient notification</h2><Switch checked={form.patientNotification} onCheckedChange={(checked) => updateForm("patientNotification", checked)} /></div><p className="mt-3 text-[9px] leading-4 text-[#8190A5]">On save, the patient will receive an in-app notification summarising the changes to their care tasks and schedule.</p></CardContent></Card>
        </aside>
      </div>

      <AddTaskModal kind="monitoring" open={addingMonitoring} onClose={() => setAddingMonitoring(false)} onAdd={(task) => updateForm("monitoring", [...form.monitoring, { id: crypto.randomUUID(), name: task.title, frequency: task.summary, cadence: task.description }])} />
      <DeleteDialog label="monitoring item" open={Boolean(deletingMonitoringId)} onOpenChange={(open) => { if (!open) setDeletingMonitoringId(null); }} onConfirm={() => { updateForm("monitoring", form.monitoring.filter((item) => item.id !== deletingMonitoringId)); setDeletingMonitoringId(null); }} />
      <SaveConfirmationModal isOpen={Boolean(modalMode)} onClose={() => setModalMode(null)} onConfirm={(reason) => save(modalMode ?? "patch", reason)} currentVersion={form.version} nextVersion={modalMode === "post" ? form.version + 1 : form.version} patientName={patient.name} createsVersion={modalMode === "post"} />
    </div>
  );
}
