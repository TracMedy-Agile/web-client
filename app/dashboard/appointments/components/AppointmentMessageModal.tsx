"use client";

import { FormEvent, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "@/lib/api/messages";

type Props = {
  open: boolean;
  appointmentId: string;
  patientName: string;
  title: string;
  initialContent?: string;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
};

export function AppointmentMessageModal({ open, appointmentId, patientName, title, initialContent = "", onOpenChange, onSent }: Props) {
  const [content, setContent] = useState(() => initialContent);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    setIsSending(true);
    setError("");
    try {
      await sendMessage({ appointmentId, content: content.trim() });
      onSent();
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSending && onOpenChange(next)}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Send an appointment-linked message to {patientName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Textarea autoFocus value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write the message..." className="min-h-36 resize-none" />
          {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSending || !content.trim()}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
