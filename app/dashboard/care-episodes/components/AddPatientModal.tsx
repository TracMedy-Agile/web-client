"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, Search, Stethoscope, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addPatientToQueue, searchPatients, type PatientSearchResult } from "@/lib/api/care-episodes";
import { searchClinicians, type ClinicianSearchResult } from "@/lib/api/clinicians";
import { cn } from "@/lib/utils";
import type {
  AddPatientFormData,
  AddPatientModalProps,
  CareEpisodeReason,
  ClinicalConcern,
  ConditionSeverity,
  FollowUpDuration,
} from "./types";

const ENCOUNTER_TYPES = ["Outpatient", "Inpatient", "Emergency", "Telehealth"] as const;
const DISCHARGE_STATUSES = ["Outpatient", "Admitted", "Discharged", "Under Observation"] as const;
const FOLLOW_UP_TRIGGERS = ["Outpatient", "Scheduled", "As Needed", "Urgent"] as const;
const FOLLOW_UP_DURATIONS = ["1 Week", "2 Weeks", "1 Month", "2 Months", "3 Months", "6 Months"] as const;
const SEVERITIES: ConditionSeverity[] = ["Mild", "Moderate", "Severe"];
const CONCERN_LEVELS: ClinicalConcern[] = ["None", "Mild", "Moderate", "High"];
const CARE_EPISODE_REASONS: CareEpisodeReason[] = [
  "Medication monitoring",
  "Post-surgical recovery",
  "Symptom monitoring",
  "Chronic disease management",
];

// CreateCareEpisodeDto.followUpReasons expects free-form strings; slugified to match the
// snake_case style shown in the openapi.yaml example ("medication_adjustment").
const CARE_EPISODE_REASON_SLUGS: Record<CareEpisodeReason, string> = {
  "Medication monitoring": "medication_monitoring",
  "Post-surgical recovery": "post_surgical_recovery",
  "Symptom monitoring": "symptom_monitoring",
  "Chronic disease management": "chronic_disease_management",
};

// CreateCareEpisodeDto.expectedDurationDays is a day count; the form collects a duration label.
const FOLLOW_UP_DURATION_DAYS: Record<FollowUpDuration, number> = {
  "1 Week": 7,
  "2 Weeks": 14,
  "1 Month": 30,
  "2 Months": 60,
  "3 Months": 90,
  "6 Months": 180,
};

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

const INITIAL_FORM_DATA: AddPatientFormData = {
  patientName: "",
  phoneNumber: "",
  tracmedyPatientId: "",
  clinicianName: "",
  consultationDate: "",
  encounterType: "Outpatient",
  dischargeStatus: "Outpatient",
  followUpTrigger: "Outpatient",
  diagnosis: "",
  clinicianNotes: "",
  conditionSeverity: "Moderate",
  clinicalConcern: "Moderate",
  followUpDuration: "1 Week",
  reasons: ["Medication monitoring", "Symptom monitoring"],
};

const fieldClassName =
  "h-11 rounded-lg border-transparent bg-[#F1F3F5] px-3.5 text-sm font-medium text-[#172033] shadow-none placeholder:text-[#7689A5] focus-visible:border-[#74A9E5] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#0B5CAB]/10 focus-visible:ring-offset-0";

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F2FF] text-[#1769C2]">
        {icon}
      </span>
      <h3 className="text-sm font-extrabold uppercase tracking-[0.04em] text-[#182132]">{children}</h3>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#182132]">{children}</span>;
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(fieldClassName, "w-full focus:ring-2 focus:ring-[#0B5CAB]/10 focus:ring-offset-0")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[70] border-[#DDE3EC]">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SegmentedRadio<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as T)}
      className="flex h-10 gap-1 rounded-xl bg-[#E4F0FF] p-1"
    >
      {options.map((option) => (
        <div key={option} className="relative min-w-0 flex-1">
          <RadioGroupItem
            value={option}
            aria-label={option}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer rounded-lg border-0 opacity-0"
          />
          <span
            className="pointer-events-none flex h-8 items-center justify-center rounded-lg text-xs font-bold text-[#344054] transition-colors"
            style={
              option === value
                ? { backgroundColor: "#FFFFFF", color: "#034B9A", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)" }
                : undefined
            }
          >
            {option}
          </span>
        </div>
      ))}
    </RadioGroup>
  );
}

type SearchFieldProps<T> = {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderItem: (item: T) => React.ReactNode;
  getItemKey: (item: T) => string;
  isSelected: boolean;
  emptyLabel: string;
  required?: boolean;
};

// Shared typeahead used for both patient and clinician lookup: debounced search (min
// SEARCH_MIN_CHARS characters), loading/empty states, click-outside close, and arrow-key +
// Enter navigation. A selection stores the real backend record; editing the text afterwards
// clears the selection so a fresh search can start.
function SearchField<T,>({
  label,
  placeholder,
  value,
  onValueChange,
  onSearch,
  onSelect,
  onClear,
  renderItem,
  getItemKey,
  isSelected,
  emptyLabel,
  required,
}: SearchFieldProps<T>) {
  const [results, setResults] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (isSelected || query.length < SEARCH_MIN_CHARS) return;

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const items = await onSearch(query);
        if (ignore) return;
        setResults(items);
        setHasSearched(true);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch {
        if (!ignore) {
          setResults([]);
          setHasSearched(true);
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isSelected]);

  const selectItem = (item: T) => {
    onSelect(item);
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        event.preventDefault();
        selectItem(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const showDropdown = isOpen && !isSelected && (results.length > 0 || (hasSearched && !isLoading));

  return (
    <div ref={containerRef} className="relative block">
      <FieldLabel>{label}</FieldLabel>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7689A5]" />
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            onValueChange(nextValue);
            if (isSelected) onClear();
            if (nextValue.trim().length < SEARCH_MIN_CHARS) {
              setResults([]);
              setHasSearched(false);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (results.length > 0 && !isSelected) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(fieldClassName, "pl-10 pr-9")}
          autoComplete="off"
          required={required}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
        {isLoading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#7689A5]" />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              onClear();
              setResults([]);
              setIsOpen(false);
              setHasSearched(false);
            }}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#7689A5] transition-colors hover:bg-[#E5EAF0] hover:text-[#344054]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>

      {showDropdown ? (
        <div className="absolute z-[70] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#DDE3EC] bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
          {results.length > 0
            ? results.map((item, index) => (
                <button
                  key={getItemKey(item)}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectItem(item)}
                  className={cn(
                    "block w-full px-3.5 py-2.5 text-left transition-colors",
                    index === activeIndex ? "bg-[#EEF2F6]" : "hover:bg-[#F8FAFC]",
                  )}
                >
                  {renderItem(item)}
                </button>
              ))
            : (
                <p className="px-3.5 py-3 text-sm font-medium text-[#7689A5]">{emptyLabel}</p>
              )}
        </div>
      ) : null}
    </div>
  );
}

export function AddPatientModal({ open, onOpenChange, facilityId, onCreated }: AddPatientModalProps) {
  const [formData, setFormData] = useState<AddPatientFormData>(INITIAL_FORM_DATA);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedClinicianId, setSelectedClinicianId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateFormData = <Key extends keyof AddPatientFormData>(
    key: Key,
    value: AddPatientFormData[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setSelectedPatientId("");
    setSelectedClinicianId("");
    setError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const toggleReason = (reason: CareEpisodeReason, checked: boolean) => {
    updateFormData(
      "reasons",
      checked
        ? Array.from(new Set([...formData.reasons, reason]))
        : formData.reasons.filter((item) => item !== reason),
    );
  };

  const selectPatient = (patient: PatientSearchResult) => {
    setSelectedPatientId(patient.id);
    updateFormData("patientName", patient.name);
    updateFormData("tracmedyPatientId", patient.tracmedyPatientId);
    if (patient.phone) updateFormData("phoneNumber", patient.phone);
  };

  const clearPatient = () => {
    setSelectedPatientId("");
    updateFormData("tracmedyPatientId", "");
  };

  const selectClinician = (clinician: ClinicianSearchResult) => {
    setSelectedClinicianId(clinician.id);
    updateFormData("clinicianName", clinician.name);
  };

  const clearClinician = () => {
    setSelectedClinicianId("");
  };

  const validateForm = () => {
    if (!formData.patientName.trim()) return "Search for and select the patient.";
    if (!selectedPatientId) return "Select a patient from the search results.";
    if (!formData.phoneNumber.trim()) return "Enter the patient's phone number.";
    if (!/^\+?[0-9\s()-]{7,20}$/.test(formData.phoneNumber.trim())) return "Enter a valid phone number.";
    if (!formData.clinicianName.trim()) return "Search for and select the clinician.";
    if (!selectedClinicianId) return "Select a clinician from the search results.";
    if (!formData.consultationDate) return "Select the consultation date.";
    if (!formData.diagnosis.trim()) return "Enter a diagnosis.";
    if (!formData.clinicianNotes.trim()) return "Enter the clinician notes.";
    if (formData.reasons.length === 0) return "Select at least one reason for the care episode.";
    if (!facilityId) return "Unable to determine your facility. Please sign in again and retry.";
    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await addPatientToQueue({
        patientId: selectedPatientId,
        facilityId,
        diagnosis: formData.diagnosis.trim(),
        clinicianId: selectedClinicianId,
        tracmedyPatientId: formData.tracmedyPatientId.trim() || undefined,
        encounterType: formData.encounterType,
        conditionSeverity: formData.conditionSeverity.toLowerCase(),
        clinicalConcern: formData.clinicalConcern,
        followUpReasons: formData.reasons.map((reason) => CARE_EPISODE_REASON_SLUGS[reason]),
        expectedDurationDays: FOLLOW_UP_DURATION_DAYS[formData.followUpDuration],
        clinicianNotes: formData.clinicianNotes.trim(),
      });
      toast.success("Patient added to the care queue.");
      onCreated();
      resetForm();
      onOpenChange(false);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to add patient. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[900px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#E5EAF0] bg-[#FBFCFE] px-5 sm:px-8">
            <DialogPrimitive.Title className="text-lg font-bold text-[#151D2C] sm:text-xl">
              Manual Patient Entry
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Add a patient manually to the care episode queue.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              type="button"
              aria-label="Close manual patient entry"
              disabled={isSubmitting}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#344054] transition-colors hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="overflow-y-auto px-5 py-7 sm:px-8 sm:py-8" style={{ maxHeight: "calc(90vh - 152px)" }}>
              {error ? (
                <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              ) : null}

              <SectionTitle icon={<UserRound className="h-5 w-5" />}>Patient Information</SectionTitle>
              <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <SearchField<PatientSearchResult>
                  label="Patient Name"
                  placeholder="Search by name, email, phone, or ID"
                  value={formData.patientName}
                  onValueChange={(value) => updateFormData("patientName", value)}
                  onSearch={searchPatients}
                  onSelect={selectPatient}
                  onClear={clearPatient}
                  isSelected={Boolean(selectedPatientId)}
                  emptyLabel="No patients found."
                  required
                  getItemKey={(patient) => patient.id}
                  renderItem={(patient) => (
                    <>
                      <span className="block text-sm font-bold text-[#172033]">{patient.name}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[#7689A5]">
                        {patient.tracmedyPatientId || "No Tracmedy ID on file"}
                      </span>
                    </>
                  )}
                />
                <label className="block">
                  <FieldLabel>Phone Number</FieldLabel>
                  <Input
                    value={formData.phoneNumber}
                    onChange={(event) => updateFormData("phoneNumber", event.target.value)}
                    placeholder="+2348108390949"
                    className={fieldClassName}
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </label>
                <label className="block">
                  <FieldLabel>Tracmedy Patient ID</FieldLabel>
                  <Input
                    value={formData.tracmedyPatientId}
                    placeholder="Auto-filled after selecting a patient"
                    className={cn(fieldClassName, "text-[#7689A5]")}
                    readOnly
                  />
                </label>
                <SearchField<ClinicianSearchResult>
                  label="Clinician Name"
                  placeholder="Search clinicians by name"
                  value={formData.clinicianName}
                  onValueChange={(value) => updateFormData("clinicianName", value)}
                  onSearch={searchClinicians}
                  onSelect={selectClinician}
                  onClear={clearClinician}
                  isSelected={Boolean(selectedClinicianId)}
                  emptyLabel="No clinicians found."
                  required
                  getItemKey={(clinician) => clinician.id}
                  renderItem={(clinician) => (
                    <>
                      <span className="block text-sm font-bold text-[#172033]">{clinician.name}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[#7689A5]">
                        {clinician.department || "No department on file"}
                      </span>
                    </>
                  )}
                />
              </div>

              <div className="mt-9">
                <SectionTitle icon={<Stethoscope className="h-5 w-5" />}>Clinical Encounter Details</SectionTitle>
              </div>
              <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Consultation Date</FieldLabel>
                  <Input
                    type="date"
                    value={formData.consultationDate}
                    onChange={(event) => updateFormData("consultationDate", event.target.value)}
                    className={cn(fieldClassName, "text-[#7689A5]")}
                    required
                  />
                </label>
                <FormSelect
                  label="Encounter Type"
                  value={formData.encounterType}
                  options={ENCOUNTER_TYPES}
                  onChange={(value) => updateFormData("encounterType", value as AddPatientFormData["encounterType"])}
                />
                <FormSelect
                  label="Discharge Status"
                  value={formData.dischargeStatus}
                  options={DISCHARGE_STATUSES}
                  onChange={(value) => updateFormData("dischargeStatus", value as AddPatientFormData["dischargeStatus"])}
                />
                <FormSelect
                  label="Follow-up Trigger"
                  value={formData.followUpTrigger}
                  options={FOLLOW_UP_TRIGGERS}
                  onChange={(value) => updateFormData("followUpTrigger", value as AddPatientFormData["followUpTrigger"])}
                />
              </div>

              <label className="mt-6 block">
                <FieldLabel>Diagnosis</FieldLabel>
                <Input
                  value={formData.diagnosis}
                  onChange={(event) => updateFormData("diagnosis", event.target.value)}
                  placeholder="e.g. Hypertension management, Post-op recovery"
                  className={fieldClassName}
                  required
                />
              </label>

              <label className="mt-6 block">
                <FieldLabel>Clinician Notes</FieldLabel>
                <Textarea
                  value={formData.clinicianNotes}
                  onChange={(event) => updateFormData("clinicianNotes", event.target.value)}
                  placeholder="Enter detailed observations, clinical notes, or specific instructions for the care team..."
                  className={cn(fieldClassName, "min-h-[112px] resize-none py-4 leading-6")}
                  style={{ minHeight: 112 }}
                  required
                />
              </label>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <FieldLabel>Condition Severity</FieldLabel>
                  <SegmentedRadio
                    label="Condition severity"
                    value={formData.conditionSeverity}
                    options={SEVERITIES}
                    onChange={(value) => updateFormData("conditionSeverity", value)}
                  />
                </div>
                <div>
                  <FieldLabel>Clinical Concern Flag</FieldLabel>
                  <SegmentedRadio
                    label="Clinical concern flag"
                    value={formData.clinicalConcern}
                    options={CONCERN_LEVELS}
                    onChange={(value) => updateFormData("clinicalConcern", value)}
                  />
                </div>
              </div>

              <div className="mt-8 grid items-start gap-6 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#182132]">
                    Reason For Care Episode
                  </legend>
                  <div className="space-y-2">
                    {CARE_EPISODE_REASONS.map((reason) => {
                      const checked = formData.reasons.includes(reason);
                      return (
                        <label
                          key={reason}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-[#E7F2FF] px-3 py-2.5 text-sm font-medium text-[#172033]"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => toggleReason(reason, nextChecked === true)}
                            className={cn(
                              "border-[#7892B2] data-[state=checked]:border-[#034B9A] data-[state=checked]:bg-[#034B9A]",
                              checked && "border-[#034B9A] text-white",
                            )}
                            style={
                              checked
                                ? { backgroundColor: "#034B9A", borderColor: "#034B9A", color: "#FFFFFF" }
                                : undefined
                            }
                          />
                          {reason}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="min-w-0 space-y-7">
                  <FormSelect
                    label="Follow-up Duration"
                    value={formData.followUpDuration}
                    options={FOLLOW_UP_DURATIONS}
                    onChange={(value) => updateFormData("followUpDuration", value as AddPatientFormData["followUpDuration"])}
                  />

                  <div className="w-full min-w-0 rounded-xl border border-[#B9D8FF] bg-[#F0F6FF] p-4 text-[#034B9A]">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#172033]">Quick Summary</p>
                    <p className="mt-2 text-sm leading-5">
                      Patient will be added to the <strong>{formData.encounterType}</strong> queue with a{" "}
                      <strong>{formData.conditionSeverity} Risk</strong> flag. Initial follow-up scheduled for{" "}
                      <strong>{formData.followUpDuration} from today.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-stretch justify-end gap-3 border-t border-[#E5EAF0] bg-[#FBFCFE] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="h-11 px-4 text-sm font-bold text-[#344054] hover:bg-[#EEF2F6]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 rounded-xl bg-[#064B91] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#023E8A]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add To Care Queue"
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
