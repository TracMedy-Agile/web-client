import {
  getRecordArray,
  getString,
  type ApiRecord,
  type MedicationAdherenceRecord,
  type TaskCompletionLog,
  type TaskCompletionLogEntry,
  type TimelineEventRecord,
} from "@/lib/api/care-episodes";

export type CareTaskRow = {
  id: string;
  label: string;
  sub: string;
  done: boolean;
  missed: boolean;
  kind: "task" | "medication";
  completion: TaskCompletionLogEntry | null;
  completedAt: string | null;
  source: string | null;
};

type BuildCareTaskRowsOptions = {
  date: string;
  completionLog: TaskCompletionLog | null;
  medicationRecords?: MedicationAdherenceRecord[];
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dateKey(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTaskCompleted(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "completed" || status === "done" || task.completed === true;
}

function isTaskMissed(task: ApiRecord) {
  const status = getString(task, ["status"]).toLowerCase();
  return status === "missed" || status === "overdue" || task.missed === true;
}

function taskCandidates(task: ApiRecord, index: number) {
  return unique([
    getString(task, ["id", "_id", "taskId", "key", "carePlanTaskKey"]),
    `task-${index}`,
    String(index),
  ]);
}

function medicationCandidates(medication: ApiRecord, index: number, medicationRecord: MedicationAdherenceRecord | null) {
  return unique([
    `medication-${index}`,
    getString(medication, ["carePlanTaskKey", "taskId", "key", "id", "_id", "medicationId"]),
    medicationRecord?.medicationId ?? "",
  ]);
}

function completedIdSet(completionLog: TaskCompletionLog | null) {
  return new Set((completionLog?.completedTaskIds ?? []).map(normalizeKey));
}

function findCompletion(candidates: string[], completionLog: TaskCompletionLog | null) {
  if (!completionLog) return null;
  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  return completionLog.tasks.find((task) => normalizedCandidates.has(normalizeKey(task.taskId))) ?? null;
}

function hasCompletedId(candidates: string[], completionLog: TaskCompletionLog | null) {
  const ids = completedIdSet(completionLog);
  return candidates.some((candidate) => ids.has(normalizeKey(candidate)));
}

function findMedicationRecord(medication: ApiRecord, index: number, records: MedicationAdherenceRecord[]) {
  const directIds = unique([
    getString(medication, ["medicationId", "id", "_id"]),
    `medication-${index}`,
  ]).map(normalizeKey);
  const name = normalizeName(getString(medication, ["name", "medicationName"]));
  const dosage = normalizeName(getString(medication, ["dosage", "dosageStrength", "strength"]));

  return records.find((record) => {
    if (directIds.includes(normalizeKey(record.medicationId))) return true;
    if (!name || normalizeName(record.name) !== name) return false;
    return !dosage || normalizeName(record.dosageStrength) === dosage;
  }) ?? null;
}

function medicationWasTakenOnDate(record: MedicationAdherenceRecord | null, date: string) {
  return Boolean(record?.lastTakenAt && dateKey(record.lastTakenAt) === date);
}

export function buildCareTaskRows(carePlan: ApiRecord | null, options: BuildCareTaskRowsOptions): CareTaskRow[] {
  const { completionLog, date, medicationRecords = [] } = options;
  const rows: CareTaskRow[] = getRecordArray(carePlan, ["tasks"]).map((task, index) => {
    const candidates = taskCandidates(task, index);
    const completion = findCompletion(candidates, completionLog);
    const completionStatus = completion?.status.toLowerCase() ?? "";
    const done = isTaskCompleted(task) || completion?.completed === true || hasCompletedId(candidates, completionLog);
    return {
      id: candidates[0] || `task-${index}`,
      label: getString(task, ["title", "name", "label"], "Task"),
      sub: getString(task, ["frequency", "schedule", "dueAt", "scheduledAt", "dueDate"]),
      done,
      missed: !done && (isTaskMissed(task) || completionStatus === "missed" || completionStatus === "overdue"),
      kind: "task",
      completion,
      completedAt: completion?.completedAt ?? null,
      source: completion?.source ?? null,
    };
  });

  const medicationRows: CareTaskRow[] = getRecordArray(carePlan, ["medications"]).map((medication, index) => {
    const medicationRecord = findMedicationRecord(medication, index, medicationRecords);
    const candidates = medicationCandidates(medication, index, medicationRecord);
    const completion = findCompletion(candidates, completionLog);
    const completionStatus = completion?.status.toLowerCase() ?? "";
    const takenToday = medicationWasTakenOnDate(medicationRecord, date);
    const done = completion?.completed === true || hasCompletedId(candidates, completionLog) || takenToday || isTaskCompleted(medication);
    const missed = !done && (isTaskMissed(medication) || completionStatus === "missed" || completionStatus === "overdue" || (medicationRecord?.missedCount ?? 0) > 0);
    return {
      id: candidates[0] || `medication-${index}`,
      label: getString(medication, ["name", "medicationName"], medicationRecord?.name ?? "Medication"),
      sub: unique([
        getString(medication, ["dosage", "dosageStrength", "strength"], medicationRecord?.dosageStrength ?? ""),
        getString(medication, ["frequency", "schedule"]),
      ]).join(" - "),
      done,
      missed,
      kind: "medication",
      completion,
      completedAt: completion?.completedAt ?? medicationRecord?.lastTakenAt ?? null,
      source: completion?.source ?? "patient_app",
    };
  });

  return [...rows, ...medicationRows];
}

export function buildMedicationCompletionTimelineEvents(
  episodeId: string,
  carePlan: ApiRecord | null,
  completionLog: TaskCompletionLog | null,
  medicationRecords: MedicationAdherenceRecord[],
  date: string,
): TimelineEventRecord[] {
  return buildCareTaskRows(carePlan, { date, completionLog, medicationRecords })
    .filter((row) => row.kind === "medication" && row.done)
    .map((row) => ({
      id: `medication-completion-${row.id}-${date}`,
      episodeId,
      eventType: "medication_taken",
      source: row.source || "patient_app",
      status: "completed",
      payload: {
        message: `${row.label} taken`,
        description: row.sub ? `${row.sub} marked taken in the patient app.` : "Marked taken in the patient app.",
        medicationName: row.label,
        taskId: row.id,
      },
      timestamp: row.completedAt || `${date}T00:00:00.000Z`,
    }));
}

function hasMatchingMedicationEvent(events: TimelineEventRecord[], synthetic: TimelineEventRecord) {
  const syntheticDate = dateKey(synthetic.timestamp);
  const syntheticPayload = synthetic.payload;
  const medicationName = normalizeName(getString(syntheticPayload, ["medicationName", "message", "title"]));
  const taskId = normalizeKey(getString(syntheticPayload, ["taskId", "carePlanTaskKey", "medicationId"]));

  return events.some((event) => {
    if (dateKey(event.timestamp) !== syntheticDate) return false;
    const payload = event.payload;
    const eventTaskId = normalizeKey(getString(payload, ["taskId", "carePlanTaskKey", "medicationId"]));
    const text = normalizeName(`${event.eventType} ${getString(payload, ["message", "title"])} ${getString(payload, ["description", "details", "summary"])}`);
    if (!text.includes("medication") && !text.includes("dose") && !text.includes("taken")) return false;
    if (taskId && eventTaskId && taskId === eventTaskId) return true;
    return Boolean(medicationName && text.includes(medicationName.split(" taken")[0] ?? medicationName));
  });
}

export function mergeTimelineWithMedicationCompletionEvents(
  events: TimelineEventRecord[],
  medicationCompletionEvents: TimelineEventRecord[],
) {
  const additions = medicationCompletionEvents.filter((event) => !hasMatchingMedicationEvent(events, event));
  const seen = new Set<string>();
  return [...additions, ...events]
    .filter((event) => {
      const key = event.id || `${event.eventType}-${event.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""));
}