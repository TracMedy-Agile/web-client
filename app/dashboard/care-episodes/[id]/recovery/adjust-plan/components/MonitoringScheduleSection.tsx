"use client";

import { useState } from "react";
import { Activity, ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import type { MonitoringItem, MonitoringTrendRule } from "../types";
import { AddRowButton, DeleteDialog, fieldClass, FieldLabel, SectionFrame } from "./SectionFrame";

const MONITORING_OPTIONS: Record<MonitoringItem["type"], string[]> = {
  "Vital Sign": ["Blood Pressure", "Heart Rate", "Temperature", "Blood Sugar", "Weight", "Oxygen Saturation"],
  Symptom: ["Shortness of Breath", "Pain", "Dizziness", "Fatigue", "Swelling"],
  Activity: ["Walking", "Exercise", "Breathing Exercise", "Physiotherapy"],
};

function newTrendRule(): MonitoringTrendRule {
  return {
    id: crypto.randomUUID(),
    condition: "Rapid Increase",
    threshold: "",
    unit: "mmHg",
    window: "24 hours",
  };
}

function newMonitoringItem(): MonitoringItem {
  return {
    id: crypto.randomUUID(),
    type: "Vital Sign",
    name: "Blood Pressure",
    frequency: "Twice Daily",
    priority: "High Priority",
    cadence: "",
    criticalLow: "",
    criticalHigh: "",
    severityThreshold: "Moderate",
    persistenceReports: "",
    minimumCompletion: "",
    missedSessions: "",
    worseningTrend: true,
    decliningPerformance: false,
    missingDataRule: "Alert after 24 hours",
    trendRules: [],
  };
}

export function MonitoringScheduleSection({
  items,
  onChange,
}: {
  items: MonitoringItem[];
  onChange: (items: MonitoringItem[]) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<string[]>(() => items.map((item) => item.id));
  const [deleting, setDeleting] = useState<MonitoringItem | null>(null);

  const update = (index: number, patch: Partial<MonitoringItem>) =>
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  const updateRule = (itemIndex: number, ruleIndex: number, patch: Partial<MonitoringTrendRule>) =>
    update(itemIndex, {
      trendRules: items[itemIndex].trendRules.map((rule, index) => (index === ruleIndex ? { ...rule, ...patch } : rule)),
    });

  return (
    <SectionFrame icon={<Activity className="h-4 w-4" />} title="Monitoring schedule" subtitle="Check-ins and vitals frequency">
      <div className="space-y-4">
        {items.map((item, itemIndex) => {
          const expanded = expandedIds.includes(item.id);
          return (
            <div key={item.id} className="rounded-xl border border-border bg-muted/25 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[152px_1fr_auto]">
                <label>
                  <FieldLabel>Monitoring Type</FieldLabel>
                  <select
                    aria-label="Monitoring type"
                    className={fieldClass}
                    value={item.type}
                    onChange={(event) => {
                      const type = event.target.value as MonitoringItem["type"];
                      update(itemIndex, { type, name: MONITORING_OPTIONS[type][0] });
                    }}
                  >
                    {Object.keys(MONITORING_OPTIONS).map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <FieldLabel>Monitoring Item</FieldLabel>
                  <select aria-label="Monitoring item" className={fieldClass} value={item.name} onChange={(event) => update(itemIndex, { name: event.target.value })}>
                    {!MONITORING_OPTIONS[item.type].includes(item.name) && item.name ? <option>{item.name}</option> : null}
                    {MONITORING_OPTIONS[item.type].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)} className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg border border-destructive/70 text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <FieldLabel>Frequency</FieldLabel>
                  <select aria-label="Monitoring frequency" className={fieldClass} value={item.frequency} onChange={(event) => update(itemIndex, { frequency: event.target.value })}>
                    <option>Once Daily</option><option>Twice Daily</option><option>Three Times Daily</option><option>Weekly</option><option>As Needed</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Priority</FieldLabel>
                  <select aria-label="Monitoring priority" className={fieldClass} value={item.priority} onChange={(event) => update(itemIndex, { priority: event.target.value })}>
                    <option>Routine</option><option>High Priority</option><option>Urgent</option>
                  </select>
                </label>
              </div>

              {item.type === "Activity" ? (
                <div className="mt-4 grid grid-cols-[180px_1fr] gap-2">
                  <input aria-label="Activity target type" className={fieldClass} value="Duration" readOnly />
                  <input aria-label="Activity target" className={fieldClass} value={item.cadence} placeholder="20 minutes" onChange={(event) => update(itemIndex, { cadence: event.target.value })} />
                </div>
              ) : null}

              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedIds((current) => expanded ? current.filter((id) => id !== item.id) : [...current, item.id])}
                className="mt-4 flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-border bg-card px-3 text-[11px] font-semibold text-foreground"
              >
                <span className="flex items-center gap-2"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />Monitoring criteria <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary"><Sparkles className="h-3 w-3" />Smart defaults</span></span>
                <span className="text-[9px] font-medium text-muted-foreground">{expanded ? "Hide" : "Show"}</span>
              </button>

              {expanded ? (
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  {item.type === "Vital Sign" ? (
                    <>
                      <p className="text-[10px] font-bold text-foreground">Critical thresholds</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label><FieldLabel>Critical Low</FieldLabel><input className={fieldClass} value={item.criticalLow} placeholder="90/60" onChange={(event) => update(itemIndex, { criticalLow: event.target.value })} /></label>
                        <label><FieldLabel>Critical High</FieldLabel><input className={fieldClass} value={item.criticalHigh} placeholder="160/100" onChange={(event) => update(itemIndex, { criticalHigh: event.target.value })} /></label>
                      </div>
                      <p className="mt-2 text-[9px] text-muted-foreground">Submitted values beyond either threshold generate a critical alert.</p>
                      <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-bold text-foreground">Trend monitoring rules</p><button type="button" onClick={() => update(itemIndex, { trendRules: [...item.trendRules, newTrendRule()] })} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Plus className="h-3.5 w-3.5" />Add rule</button></div>
                      <div className="mt-2 space-y-2">
                        {item.trendRules.map((rule, ruleIndex) => (
                          <div key={rule.id} className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2 sm:grid-cols-[1.25fr_.7fr_.7fr_.7fr_auto]">
                            <select aria-label="Trend condition" className={fieldClass} value={rule.condition} onChange={(event) => updateRule(itemIndex, ruleIndex, { condition: event.target.value })}><option>Rapid Increase</option><option>Rapid Decrease</option><option>Consecutive Readings</option><option>Percentage Change</option></select>
                            <input aria-label="Trend threshold" className={fieldClass} value={rule.threshold} placeholder="Threshold" onChange={(event) => updateRule(itemIndex, ruleIndex, { threshold: event.target.value })} />
                            <input aria-label="Trend unit" className={fieldClass} value={rule.unit} onChange={(event) => updateRule(itemIndex, ruleIndex, { unit: event.target.value })} />
                            <input aria-label="Trend window" className={fieldClass} value={rule.window} onChange={(event) => updateRule(itemIndex, ruleIndex, { window: event.target.value })} />
                            <button type="button" aria-label="Delete trend rule" onClick={() => update(itemIndex, { trendRules: item.trendRules.filter((current) => current.id !== rule.id) })} className="flex h-9 w-9 items-center justify-center justify-self-end text-destructive"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : item.type === "Symptom" ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label><FieldLabel>Severity Threshold</FieldLabel><select className={fieldClass} value={item.severityThreshold} onChange={(event) => update(itemIndex, { severityThreshold: event.target.value })}><option>Mild</option><option>Moderate</option><option>Severe</option></select></label>
                        <label><FieldLabel>Persistence — Consecutive Reports</FieldLabel><input className={fieldClass} value={item.persistenceReports} placeholder="e.g. 3" onChange={(event) => update(itemIndex, { persistenceReports: event.target.value })} /></label>
                      </div>
                      <label className="mt-3 flex items-start gap-2 rounded-lg border border-border p-3 text-[10px] text-muted-foreground"><input type="checkbox" className="mt-0.5 accent-primary" checked={item.worseningTrend} onChange={(event) => update(itemIndex, { worseningTrend: event.target.checked })} /><span><strong className="text-foreground">Worsening trend detection</strong> — alert when severity increases across submissions.</span></label>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label><FieldLabel>Minimum Completion</FieldLabel><input className={fieldClass} value={item.minimumCompletion} placeholder="e.g. 80% of target" onChange={(event) => update(itemIndex, { minimumCompletion: event.target.value })} /></label>
                        <label><FieldLabel>Missed Activity Rule (# Sessions)</FieldLabel><input className={fieldClass} value={item.missedSessions} placeholder="e.g. 2" onChange={(event) => update(itemIndex, { missedSessions: event.target.value })} /></label>
                      </div>
                      <label className="mt-3 flex items-start gap-2 rounded-lg border border-border p-3 text-[10px] text-muted-foreground"><input type="checkbox" className="mt-0.5 accent-primary" checked={item.decliningPerformance} onChange={(event) => update(itemIndex, { decliningPerformance: event.target.checked })} /><span><strong className="text-foreground">Declining performance detection</strong> — alert when activity completion trend declines beyond threshold.</span></label>
                    </>
                  )}

                  <label className="mt-5 block max-w-[260px]"><FieldLabel>Missing data rule</FieldLabel><select className={fieldClass} value={item.missingDataRule} onChange={(event) => update(itemIndex, { missingDataRule: event.target.value })}><option>Alert after 12 hours</option><option>Alert after 24 hours</option><option>Alert after 48 hours</option><option>No alert</option></select></label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <AddRowButton onClick={() => {
        const item = newMonitoringItem();
        setExpandedIds((current) => [...current, item.id]);
        onChange([...items, item]);
      }}>Add monitoring item</AddRowButton>
      <DeleteDialog label={deleting?.name ?? "monitoring item"} open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { if (deleting) onChange(items.filter((item) => item.id !== deleting.id)); setDeleting(null); }} />
    </SectionFrame>
  );
}
