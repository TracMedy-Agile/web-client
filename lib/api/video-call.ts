import {
  endAppointmentCall,
  getAppointmentCallToken,
  joinAppointmentCall,
  nudgeAppointmentCall,
  startAppointmentCall,
  type CallEndResponse,
  type CallJoinResponse,
  type CallNudgeResponse,
  type CallStartResponse,
  type CallTokenResponse,
} from "@/lib/api/appointments";

export type {
  CallEndResponse,
  CallJoinResponse,
  CallNudgeResponse,
  CallStartResponse,
  CallTokenResponse,
};

export function getCallToken(appointmentId: string): Promise<CallTokenResponse> {
  return getAppointmentCallToken(appointmentId);
}

export function startCall(appointmentId: string): Promise<CallStartResponse> {
  return startAppointmentCall(appointmentId);
}

export function joinCall(appointmentId: string): Promise<CallJoinResponse> {
  return joinAppointmentCall(appointmentId);
}

export function endCall(appointmentId: string): Promise<CallEndResponse> {
  return endAppointmentCall(appointmentId);
}

export function nudgePatient(appointmentId: string): Promise<CallNudgeResponse> {
  return nudgeAppointmentCall(appointmentId);
}