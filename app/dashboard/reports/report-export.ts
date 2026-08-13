import type {
  ClinicianWorkload,
  ReportCareEpisode,
  ReportsSnapshot,
} from "@/lib/api/reports";

export type ReportType =
  | "closed-episode"
  | "alert-response"
  | "appointment-activity"
  | "clinician-workload";
export type OutputFormat = "PDF" | "CSV" | "Excel";

type ExportOptions = {
  reportType: ReportType;
  format: OutputFormat;
  timeRange: string;
  included: string[];
  clinicianId: string;
  episodeId: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createSimplePdf(title: string, rows: string[][]) {
  const lines = rows
    .filter((row) => row.some(Boolean))
    .map((row) => row.filter(Boolean).join(": "))
    .slice(0, 28);
  const textCommands = [
    `BT /F1 18 Tf 72 740 Td (${escapePdfText(title)}) Tj ET`,
    ...lines.map(
      (line, index) =>
        `BT /F1 10 Tf 72 ${712 - index * 22} Td (${escapePdfText(line).slice(0, 105)}) Tj ET`,
    ),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return document;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function createCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createExcelXml(rows: string[][]) {
  const table = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report"><Table>${table}</Table></Worksheet>
</Workbook>`;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value || "Not recorded", (counts.get(value || "Not recorded") ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function commonRows(snapshot: ReportsSnapshot, title: string, timeRange: string) {
  return [
    ["Tracmedy Report", title],
    ["Facility", snapshot.facility.name],
    ["Facility ID", snapshot.facility.id],
    ["Scope", "Authenticated facility only"],
    ["Time range", timeRange],
    ["Date from", snapshot.range.dateFrom],
    ["Date to", snapshot.range.dateTo],
    ["Generated at", new Date().toISOString()],
    [],
  ];
}

function closedEpisodeRows(episode: ReportCareEpisode | undefined) {
  if (!episode) return [["No matching closed care episode was found."]];
  return [
    ["Episode ID", episode.id],
    ["Patient ID", episode.patientId],
    ["Diagnosis", episode.diagnosis],
    ["Status", episode.status],
    ["Risk category", episode.riskCategory],
    ["Outcome", episode.outcomeStatus],
    ["Closure reason", episode.closureReason],
    ["Opened", episode.createdAt],
    ["Closed", episode.closedAt],
  ];
}

function alertRows(snapshot: ReportsSnapshot, included: string[]) {
  const rows: string[][] = [
    ["Handled alerts", String(snapshot.alerts.length)],
    [
      "Average response time",
      snapshot.averageAlertResponseMinutes === null
        ? "Not available"
        : `${snapshot.averageAlertResponseMinutes} minutes`,
    ],
  ];

  if (included.includes("Breakdown by severity")) {
    rows.push([], ["Severity", "Handled alerts"]);
    countBy(snapshot.alerts.map((alert) => alert.severity)).forEach(([severity, count]) => {
      rows.push([severity, String(count)]);
    });
  }

  if (included.includes("Response time trend")) {
    rows.push([], ["Period", "Handled", "Average response minutes"]);
    snapshot.alertPerformance.forEach((point) => {
      rows.push([
        point.label,
        String(point.handled),
        point.responseMinutes === null ? "" : String(point.responseMinutes),
      ]);
    });
  }

  if (included.includes("Per-clinician breakdown")) {
    rows.push([], ["Clinician", "Open alerts", "Average response time"]);
    snapshot.clinicians.forEach((clinician) => {
      rows.push([clinician.name, String(clinician.alerts), clinician.responseTime]);
    });
  }
  return rows;
}

function appointmentRows(snapshot: ReportsSnapshot, included: string[]) {
  const rows: string[][] = [
    ["Appointments", String(snapshot.appointments.length)],
    ["Completed", String(snapshot.appointments.filter((item) => item.status === "completed").length)],
    ["Cancelled", String(snapshot.appointments.filter((item) => item.status === "cancelled").length)],
    ["No shows", String(snapshot.appointments.filter((item) => item.status === "no_show").length)],
  ];

  if (included.includes("No-shows & cancellations")) {
    rows.push([], ["Status", "Appointments"]);
    countBy(snapshot.appointments.map((appointment) => appointment.status)).forEach(([status, count]) => {
      rows.push([status, String(count)]);
    });
  }

  if (included.includes("Per-department breakdown")) {
    rows.push([], ["Department", "Appointments"]);
    countBy(snapshot.appointments.map((appointment) => appointment.department)).forEach(([department, count]) => {
      rows.push([department, String(count)]);
    });
  }

  if (included.includes("Booking trend")) {
    rows.push([], ["Period", "In person", "Teleconsultations"]);
    snapshot.consultationTrend.forEach((point) => {
      rows.push([point.label, String(point.physical), String(point.teleconsultations)]);
    });
  }
  return rows;
}

function facilityAnalyticsRows(snapshot: ReportsSnapshot) {
  const rows: string[][] = [];

  if (snapshot.riskDistribution) {
    rows.push(
      [],
      ["Risk Distribution", "Episodes"],
      ["Low", String(snapshot.riskDistribution.low)],
      ["Moderate", String(snapshot.riskDistribution.moderate)],
      ["High", String(snapshot.riskDistribution.high)],
      ["Critical", String(snapshot.riskDistribution.critical)],
    );
  }

  if (snapshot.readmissionTrend.length > 0) {
    rows.push([], ["Readmission / Recovery Trend", "Readmission Rate", "Avg Recovery Days"]);
    snapshot.readmissionTrend.forEach((point) => {
      rows.push([
        point.label,
        point.readmissionRate === null ? "" : `${point.readmissionRate}%`,
        point.avgRecoveryDays === null ? "" : String(point.avgRecoveryDays),
      ]);
    });
  }

  if (snapshot.wardPerformance.length > 0) {
    rows.push([], ["Ward", "Active Episodes", "Open Alerts", "Avg Alert Response", "Avg Recovery Days", "Recovered"]);
    snapshot.wardPerformance.forEach((ward) => {
      rows.push([
        ward.ward,
        String(ward.activeEpisodes),
        String(ward.openAlerts),
        ward.avgAlertResponseMinutes == null ? "" : String(ward.avgAlertResponseMinutes),
        ward.avgRecoveryDays == null ? "" : String(ward.avgRecoveryDays),
        String(ward.recoveredCount),
      ]);
    });
  }

  return rows;
}
function clinicianRows(clinicians: ClinicianWorkload[], included: string[]) {
  const header = ["Clinician", "Specialty"];
  if (included.includes("Active episodes")) header.push("Active episodes");
  if (included.includes("Open alerts")) header.push("Open alerts");
  if (included.includes("Average response time")) header.push("Average response time");
  header.push("Workload status", "Capacity utilization");

  return [
    header,
    ...clinicians.map((clinician) => {
      const row = [clinician.name, clinician.specialty];
      if (included.includes("Active episodes")) row.push(String(clinician.episodes));
      if (included.includes("Open alerts")) row.push(String(clinician.alerts));
      if (included.includes("Average response time")) row.push(clinician.responseTime);
      row.push(clinician.status, `${clinician.capacityUtilization}%`);
      return row;
    }),
  ];
}

function getTitle(reportType: ReportType) {
  if (reportType === "closed-episode") return "Patient Closed Episode Summary";
  if (reportType === "alert-response") return "Alert Response Performance";
  if (reportType === "appointment-activity") return "Appointment Activity Report";
  return "Clinician Workload Report";
}

function buildRows(snapshot: ReportsSnapshot, options: ExportOptions) {
  const rows = commonRows(snapshot, getTitle(options.reportType), options.timeRange);
  if (options.reportType === "closed-episode") {
    return rows.concat(closedEpisodeRows(
      snapshot.careEpisodes.find((episode) => episode.id === options.episodeId && episode.status === "closed"),
    ));
  }
  if (options.reportType === "alert-response") {
    return rows.concat(alertRows(snapshot, options.included), facilityAnalyticsRows(snapshot));
  }
  if (options.reportType === "appointment-activity") {
    return rows.concat(appointmentRows(snapshot, options.included), facilityAnalyticsRows(snapshot));
  }
  const clinicians = options.clinicianId === "all"
    ? snapshot.clinicians
    : snapshot.clinicians.filter((clinician) => clinician.id === options.clinicianId);
  return rows.concat(clinicianRows(clinicians, options.included), facilityAnalyticsRows(snapshot));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "facility";
}

export function downloadReport(snapshot: ReportsSnapshot, options: ExportOptions) {
  const rows = buildRows(snapshot, options);
  const title = getTitle(options.reportType);
  let content: string;
  let mimeType: string;
  let extension: string;

  if (options.format === "PDF") {
    content = createSimplePdf(title, rows);
    mimeType = "application/pdf";
    extension = "pdf";
  } else if (options.format === "Excel") {
    content = createExcelXml(rows);
    mimeType = "application/vnd.ms-excel;charset=utf-8";
    extension = "xls";
  } else {
    content = createCsv(rows);
    mimeType = "text/csv;charset=utf-8";
    extension = "csv";
  }

  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(snapshot.facility.name)}-${options.reportType}-${snapshot.range.dateTo}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

