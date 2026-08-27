"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  type Call,
  type StreamVideoClient,
} from "@stream-io/video-react-sdk";
import { Loader2 } from "lucide-react";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import { endCall } from "@/lib/api/video-call";
import { connectStreamUser } from "@/lib/stream";

type VideoCallViewProps = {
  callCid: string;
  token: string;
  onEnd: () => void | Promise<void>;
  appointmentId?: string;
};

function parseCallCid(callCid: string) {
  const [callType, ...callIdParts] = callCid.split(":");
  const callId = callIdParts.join(":");

  if (!callType || !callId) {
    throw new Error("The video call ID is invalid.");
  }

  return { callType, callId };
}

function getAppointmentIdFromCallCid(callCid: string) {
  const [, ...callIdParts] = callCid.split(":");
  return callIdParts.join(":") || callCid;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function VideoCallView({ appointmentId, callCid, token, onEnd }: VideoCallViewProps) {
  const { user } = useDashboardUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(true);
  const hasEndedRef = useRef(false);

  const resolvedAppointmentId = appointmentId ?? getAppointmentIdFromCallCid(callCid);

  const handleEndCall = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    try {
      await call?.leave().catch(() => undefined);
      await endCall(resolvedAppointmentId);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to end the video call."));
      hasEndedRef.current = false;
      return;
    }

    await onEnd();
  }, [call, onEnd, resolvedAppointmentId]);

  useEffect(() => {
    let isActive = true;
    let activeCall: Call | null = null;

    async function joinStreamCall() {
      setIsJoining(true);
      setError("");

      try {
        if (!user?.id) throw new Error("Unable to determine the current clinician.");

        const { callType, callId } = parseCallCid(callCid);
        const nextClient = await connectStreamUser(user.id, user.name, token);
        activeCall = nextClient.call(callType, callId);
        await activeCall.join();

        if (isActive) {
          setClient(nextClient);
          setCall(activeCall);
        }
      } catch (requestError) {
        if (isActive) {
          setError(getErrorMessage(requestError, "Unable to join the video call."));
          setClient(null);
          setCall(null);
        }
      } finally {
        if (isActive) setIsJoining(false);
      }
    }

    void joinStreamCall();

    return () => {
      isActive = false;
      void activeCall?.leave().catch(() => undefined);
    };
  }, [callCid, token, user?.id, user?.name]);

  return (
    <div className="fixed inset-0 z-[90] flex bg-[#111827] text-white" role="dialog" aria-modal="true" aria-label="Video consultation">
      {isJoining ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Loader2 className="h-5 w-5 animate-spin" />
            Joining video call...
          </div>
        </div>
      ) : null}

      {!isJoining && error ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 text-center text-[#111827] shadow-2xl">
            <h2 className="text-lg font-bold">Video call unavailable</h2>
            <p className="mt-2 text-sm font-medium text-[#71809B]">{error}</p>
            <button
              type="button"
              onClick={() => {
                void onEnd();
              }}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {!isJoining && !error && client && call ? (
        <StreamVideo client={client}>
          <StreamTheme as="main" className="flex min-h-dvh flex-1 flex-col bg-[#111827]">
            <StreamCall call={call}>
              <div className="flex min-h-dvh flex-1 flex-col">
                <div className="flex min-h-0 flex-1">
                  <SpeakerLayout />
                </div>
                <div className="flex items-center justify-center border-t border-white/10 bg-black/35 px-4 py-4">
                  <CallControls
                    onLeave={() => {
                      void handleEndCall();
                    }}
                  />
                </div>
              </div>
            </StreamCall>
          </StreamTheme>
        </StreamVideo>
      ) : null}
    </div>
  );
}

export default VideoCallView;