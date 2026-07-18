"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bell, CheckCircle2, ClipboardList, History, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCarePlanVersion, getCarePlan } from "@/lib/api/care-plan";
import { getCareEpisodeById, type CareEpisodeDetail } from "@/lib/api/care-episodes";
import { createPlaceholderEpisode } from "../_shared/utils";
import type { CarePlan } from "../recovery/adjust-plan/types";
import type { CareTaskCategory } from "../_shared/careTeamTypes";
import { carePlanToTasks, tasksToCarePlanPayload, type CareTask } from "./types";
import { SaveCarePlanModal } from "./components/SaveCarePlanModal";

const CATEGORY_OPTIONS: CareTaskCategory[] = ["Medication", "Vital Check", "Symptom Log", "Activity", "Lab Test", "Home Care", "Warning Sign", "Other"];

const inputClass =
  "h-11 w-full rounded-lg border border-[#DDE3EC] bg-white px-3.5 text-sm font-medium text-[#172033] outline-none focus-visible:border-[#74A9E5] focus-visible:ring-2 focus-visible:ring-[#0B5CAB]/10";

function newTask(): CareTask {
  return { id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: "", category: "Other", frequency: "", instructions: "" };
}

export default function AdjustCarePlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const displayEpisode = episode ?? createPlaceholderEpisode(episodeId);
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [initialTasks, setInitialTasks] = useState("[]");
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    Promise.allSettled([getCareEpisodeById(episodeId), getCarePlan(episodeId)]).then(([episodeResult, planResult]) => {
      if (ignore) return;
      if (episodeResult.status === "fulfilled") setEpisode(episodeResult.value);
      if (planResult.status === "fulfilled") {
        setPlan(planResult.value);
        const nextTasks = carePlanToTasks(planResult.value);
        setTasks(nextTasks);
        setInitialTasks(JSON.stringify(nextTasks));
      } else {
        setLoadError(planResult.reason instanceof Error ? planResult.reason.message : "Failed to load the care plan.");
      }
      setIsLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [episodeId]);

  const isDirty = useMemo(() => JSON.stringify(tasks) !== initialTasks, [tasks, initialTasks]);

  const updateTask = (id: string, patch: Partial<CareTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    setJustSaved(false);
  };

  const removeTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
    setJustSaved(false);
  };

  const addTask = () => {
    setTasks((current) => [...current, newTask()]);
    setJustSaved(false);
  };

  const cancel = () => {
    if (isDirty && !window.confirm("Discard all unsaved care plan changes?")) return;
    router.push(`/dashboard/care-episodes/${episodeId}`);
  };

  const openSaveModal = () => {
    if (tasks.some((task) => !task.label.trim())) {
      toast.error("Every care task needs a label before saving.");
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmSave = async (changeReason: string) => {
    if (!plan) return;
    if (!changeReason.trim()) {
      toast.error("Describe the change reason before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = tasksToCarePlanPayload(tasks, plan, changeReason.trim(), notifyPatient);
      const saved = await createCarePlanVersion(episodeId, payload);
      setPlan(saved);
      const nextTasks = carePlanToTasks(saved);
      setTasks(nextTasks);
      setInitialTasks(JSON.stringify(nextTasks));
      setIsModalOpen(false);
      setJustSaved(true);
      toast.success("Care plan updated. Patient notified and trajectory recalculated.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to save the care plan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1080px] space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-[1080px] space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/care-episodes/${episodeId}`)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9EDF2] text-[#526078] hover:bg-[#DDE3EC]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {loadError || "Unable to load the care plan for this episode."}
        </div>
      </div>
    );
  }

  const patientName = displayEpisode.patient?.name || "this patient";
  const patientCode = displayEpisode.patient?.hospitalId || displayEpisode.patientId || "--";
  const version = plan.version || 1;

  return (
    <div className="mx-auto max-w-[1080px] space-y-5 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={cancel}
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#E9EDF2] text-[#526078] hover:bg-[#DDE3EC]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-[#111827] md:text-2xl">Adjust Care Plan</h1>
            <span className="rounded-full bg-[#E4F0FF] px-2.5 py-1 text-[10px] font-bold uppercase text-[#0753A5]">
              V{version} {plan.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-[#71809B]">
            Review and Adjust Care Plan for <strong className="text-[#344054]">{patientName} ({patientCode})</strong>
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={cancel} className="h-11 px-4 text-sm font-bold text-[#111827]">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={openSaveModal}
            disabled={!isDirty || isSaving}
            className="h-11 gap-2 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white hover:bg-[#023575]"
          >
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">
                <ClipboardList className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#111827]">Care tasks</h2>
                <p className="text-xs font-medium text-[#71809B]">Active tasks and instructions assigned to the patient</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-[#F8FAFC] p-4">
                  <div className="grid gap-2 sm:grid-cols-[1fr_160px_140px_auto]">
                    <input
                      aria-label="Task label"
                      value={task.label}
                      onChange={(event) => updateTask(task.id, { label: event.target.value })}
                      placeholder="e.g. Take morning Furosemide"
                      className={inputClass}
                    />
                    <Select value={task.category} onValueChange={(value) => updateTask(task.id, { category: value as CareTaskCategory })}>
                      <SelectTrigger className="h-11 w-full rounded-lg border-[#DDE3EC] bg-white text-sm font-medium text-[#172033]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#DDE3EC]">
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      aria-label="Task frequency"
                      value={task.frequency}
                      onChange={(event) => updateTask(task.id, { frequency: event.target.value })}
                      placeholder="Daily AM"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      aria-label={`Delete ${task.label || "task"}`}
                      onClick={() => removeTask(task.id)}
                      className="flex h-11 w-11 items-center justify-center justify-self-end rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    aria-label="Task instructions"
                    value={task.instructions}
                    onChange={(event) => updateTask(task.id, { instructions: event.target.value })}
                    placeholder="Instructions for the patient..."
                    className="mt-2 min-h-20 resize-none rounded-lg border-[#DDE3EC] bg-white py-2.5 text-sm leading-6"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addTask}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#DDE3EC] text-sm font-bold text-[#023E8A] hover:bg-[#F8FAFC]"
            >
              <Plus className="h-4 w-4" />
              Add task
            </button>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-4">
          {justSaved ? (
            <Card className="rounded-xl border-[#BEE8D2] bg-[#F0FBF6] shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]" />
                <div>
                  <p className="text-sm font-bold text-[#0F9D6C]">Care plan updated</p>
                  <p className="mt-0.5 text-xs font-medium text-[#3E8E6E]">
                    V{version} Active, Patient notified and trajectory recalculated
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold text-[#172033]">Plan summary</h2>
              <dl className="mt-4 space-y-3 text-xs text-[#71809B]">
                {[
                  ["Care tasks", tasks.filter((task) => task.category !== "Medication").length],
                  ["Medications", tasks.filter((task) => task.category === "Medication").length],
                  ["Monitoring items", tasks.filter((task) => task.category === "Vital Check").length],
                  ["Lifestyle recs", plan.lifestyleRecommendations?.length ?? 0],
                ].map(([label, count]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt>{label}</dt>
                    <dd className="font-bold text-[#172033]">{count}</dd>
                  </div>
                ))}
                <div className="flex justify-between">
                  <dt>Duration</dt>
                  <dd className="font-bold text-[#172033]">{plan.episodeDuration} days</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#172033]">
                <History className="h-4 w-4 text-[#0873DC]" />
                Version history
              </h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[#4B91E5] bg-[#F3F8FF] p-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs text-[#172033]">Version {version}.0</strong>
                    <span className="rounded-full bg-[#DDF8EA] px-2 py-0.5 text-[9px] font-bold text-[#16A76A]">ACTIVE</span>
                  </div>
                  <p className="mt-2 text-xs leading-4 text-[#71819A]">{plan.changeReason || "Care plan updated."}</p>
                  <p className="mt-2 text-right text-[10px] font-bold text-[#71819A]">{displayEpisode.updatedAt ? new Date(displayEpisode.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "--"}</p>
                </div>
                {version > 1 ? (
                  <div className="relative border-l-2 border-[#DDE3EC] pl-4">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#AAB4C2]" />
                    <strong className="text-xs text-[#526078]">Version {version - 1}.0</strong>
                    <p className="mt-1 text-[11px] text-[#8190A5]">Previous care plan revision.</p>
                  </div>
                ) : null}
                <div className="relative border-l-2 border-[#DDE3EC] pl-4">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#AAB4C2]" />
                  <strong className="text-xs text-[#526078]">Version 1.0</strong>
                  <p className="mt-1 text-[11px] text-[#8190A5]">Intake admission profile established.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#172033]">
                  <Bell className="h-4 w-4 text-[#0873DC]" />
                  Patient notification
                </h2>
                <Switch checked={notifyPatient} onCheckedChange={setNotifyPatient} />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#8190A5]">
                On save, the patient will receive an in-app notification summarising the changes to their care tasks and schedule.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <SaveCarePlanModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        currentVersion={version}
        nextVersion={version + 1}
        patientName={patientName}
        isSaving={isSaving}
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}
