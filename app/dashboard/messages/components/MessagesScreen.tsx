"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronLeft,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getMessages,
  getMessageTemplates,
  getMessageThreads,
  sendMessage,
  type MessageContextType,
  type MessageRecord,
  type MessageTemplate,
  type MessageThread,
} from "@/lib/api/messages";
import { cn } from "@/lib/utils";

type ComposerType = "INSTRUCTION" | "REMINDER" | "FOLLOW-UP";
const COMPOSER_TYPES: ComposerType[] = ["INSTRUCTION", "REMINDER", "FOLLOW-UP"];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function messageLabel(message: MessageRecord) {
  const template = message.templateUsed?.toLowerCase() ?? "";
  if (template.includes("reminder")) return "REMINDER";
  if (template.includes("follow")) return "FOLLOW-UP";
  if (message.contextType) return message.contextType.toUpperCase();
  return "INSTRUCTION";
}

function statusLabel(message: MessageRecord) {
  if (message.status === "action_completed") return "Action completed by patient";
  if (message.status === "acknowledged") return "Acknowledged by patient";
  return "Sent to patient";
}

function isContextType(value: string | null): value is MessageContextType {
  return value === "alert" || value === "biometric" || value === "symptom";
}

export function MessagesScreen() {
  const searchParams = useSearchParams();
  const requestedEpisodeId = searchParams.get("episodeId")?.trim() ?? "";
  const requestedPatientId = searchParams.get("patientId")?.trim() ?? "";
  const requestedPatientName = searchParams.get("patientName")?.trim() || "Patient";
  const requestedContent = searchParams.get("content")?.trim() || searchParams.get("message")?.trim() || "";
  const requestedContext = searchParams.get("contextType");
  const requestedContextId = searchParams.get("contextId")?.trim() ?? "";

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(requestedEpisodeId);
  const [search, setSearch] = useState("");
  const [composerType, setComposerType] = useState<ComposerType>("INSTRUCTION");
  const [content, setContent] = useState(requestedContent);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(Boolean(requestedEpisodeId));
  const [messageReload, setMessageReload] = useState(0);
  const [sending, setSending] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const [messagesError, setMessagesError] = useState("");

  async function loadThreads() {
    setLoadingThreads(true);
    setThreadsError("");
    try {
      const [nextThreads, nextTemplates] = await Promise.all([
        getMessageThreads(),
        getMessageTemplates(),
      ]);
      if (requestedEpisodeId && !nextThreads.some((thread) => thread.episodeId === requestedEpisodeId)) {
        nextThreads.unshift({
          episodeId: requestedEpisodeId,
          patientId: requestedPatientId,
          patientName: requestedPatientName,
          lastMessage: "No messages yet",
          lastMessageAt: "",
          unreadCount: 0,
          totalMessages: 0,
        });
      }
      setThreads(nextThreads);
      setTemplates(nextTemplates);
    } catch (error) {
      setThreadsError(error instanceof Error ? error.message : "Unable to load conversations.");
    } finally {
      setLoadingThreads(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([getMessageThreads(), getMessageTemplates()])
      .then(([nextThreads, nextTemplates]) => {
        if (!active) return;
        if (requestedEpisodeId && !nextThreads.some((thread) => thread.episodeId === requestedEpisodeId)) {
          nextThreads.unshift({
            episodeId: requestedEpisodeId,
            patientId: requestedPatientId,
            patientName: requestedPatientName,
            lastMessage: "No messages yet",
            lastMessageAt: "",
            unreadCount: 0,
            totalMessages: 0,
          });
        }
        setThreads(nextThreads);
        setTemplates(nextTemplates);
      })
      .catch((error: unknown) => {
        if (active) setThreadsError(error instanceof Error ? error.message : "Unable to load conversations.");
      })
      .finally(() => {
        if (active) setLoadingThreads(false);
      });
    return () => {
      active = false;
    };
  }, [requestedEpisodeId, requestedPatientId, requestedPatientName]);

  useEffect(() => {
    if (!selectedEpisodeId) {
      return;
    }
    let active = true;
    getMessages(selectedEpisodeId)
      .then((nextMessages) => {
        if (active) setMessages(nextMessages);
      })
      .catch((error: unknown) => {
        if (active) setMessagesError(error instanceof Error ? error.message : "Unable to load message history.");
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
    };
  }, [selectedEpisodeId, messageReload]);

  const selectedThread = threads.find((thread) => thread.episodeId === selectedEpisodeId) ?? null;
  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) =>
      `${thread.patientName} ${thread.lastMessage}`.toLowerCase().includes(query),
    );
  }, [search, threads]);
  const showConversationList = loadingThreads || Boolean(threadsError) || threads.length > 0;

  function selectThread(episodeId: string) {
    setMessages([]);
    setMessagesError("");
    setLoadingMessages(true);
    setSelectedEpisodeId(episodeId);
  }

  function closeThread() {
    setSelectedEpisodeId("");
    setMessages([]);
    setMessagesError("");
    setLoadingMessages(false);
  }

  function retryMessages() {
    setMessagesError("");
    setLoadingMessages(true);
    setMessageReload((value) => value + 1);
  }

  function chooseTemplate(template: MessageTemplate) {
    setSelectedTemplate(template.id);
    setContent(template.content);
    const value = `${template.id} ${template.title}`.toLowerCase();
    if (value.includes("reminder")) setComposerType("REMINDER");
    else if (value.includes("follow")) setComposerType("FOLLOW-UP");
    else setComposerType("INSTRUCTION");
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEpisodeId || !selectedThread) return;
    const messageContent = content.trim();
    if (!messageContent) {
      toast.error("Write a message before sending.");
      return;
    }

    setSending(true);
    try {
      const newMessage = await sendMessage({
        episodeId: selectedEpisodeId,
        content: messageContent,
        ...(selectedTemplate ? { templateUsed: selectedTemplate } : {}),
        ...(isContextType(requestedContext) ? { contextType: requestedContext } : {}),
        ...(isContextType(requestedContext) && requestedContextId ? { contextId: requestedContextId } : {}),
      });
      setMessages((current) => [...current, newMessage]);
      setContent("");
      setSelectedTemplate("");
      setThreads((current) => current.map((thread) =>
        thread.episodeId === selectedEpisodeId
          ? {
              ...thread,
              lastMessage: newMessage.content,
              lastMessageAt: newMessage.sentAt,
              totalMessages: thread.totalMessages + 1,
            }
          : thread,
      ));
      toast.success(`Message sent to ${selectedThread.patientName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="-m-3 flex min-h-[calc(100vh-5.5rem)] overflow-hidden border-t border-border bg-card md:-m-6 lg:-m-8">
      <aside className={cn(
        "w-full shrink-0 flex-col border-r border-border bg-card md:w-80 lg:w-[21.5rem]",
        !showConversationList ? "hidden" : selectedThread ? "hidden md:flex" : "flex",
      )}>
        <div className="shrink-0 border-b border-border py-4 pl-8 pr-4">
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patients..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/10"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="space-y-1 p-3" aria-label="Loading conversations">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : threadsError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm text-destructive">{threadsError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadThreads()}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MessageSquareText className="mx-auto h-9 w-9 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                {search ? "No matching conversations" : "No conversations yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {search ? "Try another patient name or message." : "Patient conversations will appear here after the first message."}
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.episodeId}
                type="button"
                onClick={() => selectThread(thread.episodeId)}
                className={cn(
                  "flex w-full gap-3 border-b border-border px-8 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selectedEpisodeId === thread.episodeId && "bg-primary/10",
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/35 text-sm font-bold text-primary">
                  {initials(thread.patientName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{thread.patientName}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(thread.lastMessageAt)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">{thread.lastMessage || "No messages yet"}</span>
                    {thread.unreadCount > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {thread.unreadCount}
                      </span>
                    ) : thread.totalMessages > 0 ? <CheckCheck className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className={cn(
        "min-w-0 flex-1 flex-col bg-muted/35",
        selectedThread || !showConversationList ? "flex" : "hidden md:flex",
      )}>
        {!selectedThread ? (
          <EmptyConversation hasThreads={threads.length > 0} />
        ) : (
          <>
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={closeThread}
                  aria-label="Back to conversations"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/35 text-sm font-bold text-primary">
                  {initials(selectedThread.patientName)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-foreground">{selectedThread.patientName}</h2>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">Patient conversation</p>
                </div>
              </div>
              {selectedThread.patientId ? (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/dashboard/connected-patients/${selectedThread.patientId}`}>View Profile</Link>
                </Button>
              ) : null}
            </header>

            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <LoaderCircle className="h-7 w-7 animate-spin text-primary" aria-label="Loading messages" />
                </div>
              ) : messagesError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-destructive">{messagesError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={retryMessages}>
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                  <Image
                    src="/images/messaging/empty-message.svg"
                    alt=""
                    width={248}
                    height={248}
                    className="h-44 w-44 sm:h-52 sm:w-52"
                    priority
                  />
                  <h3 className="-mt-5 text-2xl font-bold text-foreground">No Messages Yet</h3>
                  <p className="mt-2 max-w-lg text-base leading-6 text-muted-foreground">
                    Send an instruction, reminder, or follow-up to start the conversation.
                  </p>
                </div>
              ) : (
                <div className="flex w-full flex-col gap-4">
                  {messages.map((message) => (
                    <article key={message.id} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-secondary/25 px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary">
                          {messageLabel(message)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(message.sentAt)} · {message.senderName}
                        </span>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
                      <div className={cn(
                        "mt-4 flex items-center justify-end gap-1.5 text-xs font-medium",
                        message.status === "sent" ? "text-muted-foreground" : "text-emerald-700",
                      )}>
                        {message.status === "action_completed" ? <CheckCircle2 className="h-4 w-4" /> : message.status === "acknowledged" ? <CheckCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        {statusLabel(message)}
                        {message.acknowledgedAt ? ` · ${formatMessageTime(message.acknowledgedAt)}` : ""}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <form onSubmit={handleSend} className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
              <div role="tablist" aria-label="Message type" className="flex gap-5 border-b border-border">
                {COMPOSER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={composerType === type}
                    onClick={() => setComposerType(type)}
                    className={cn(
                      "relative pb-2.5 text-[11px] font-bold tracking-wide",
                      composerType === type ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {type}
                    {composerType === type ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
                  </button>
                ))}
              </div>

              {templates.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Templates:</span>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => chooseTemplate(template)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                        selectedTemplate === template.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/70 text-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {template.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10">
                <Textarea
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    if (event.target.value !== templates.find((template) => template.id === selectedTemplate)?.content) {
                      setSelectedTemplate("");
                    }
                  }}
                  placeholder={`Write ${composerType.toLowerCase()}...`}
                  aria-label={`Write ${composerType.toLowerCase()} for ${selectedThread.patientName}`}
                  className="min-h-24 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
                />
                <div className="flex justify-end border-t border-border bg-card px-3 py-2">
                  <Button type="submit" disabled={sending || !content.trim()} className="min-w-36">
                    {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending..." : `Send ${composerType === "FOLLOW-UP" ? "Follow-up" : composerType[0] + composerType.slice(1).toLowerCase()}`}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyConversation({ hasThreads }: { hasThreads: boolean }) {
  const emptyState = hasThreads
    ? {
        image: "/images/messaging/empty-conversation.svg",
        title: "No Conversation Selected",
        description: "Select a conversation to view messages and coordinate patient care.",
      }
    : {
        image: "/images/messaging/empty-message.svg",
        title: "No Messages Yet",
        description: "Select a conversation to view messages and coordinate patient care.",
      };

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Image
        src={emptyState.image}
        alt=""
        width={256}
        height={256}
        className="h-64 w-64 object-contain"
        priority
      />
      <h2 className="-mt-4 text-2xl font-bold text-foreground">{emptyState.title}</h2>
      <p className="mt-2 max-w-lg text-base leading-6 text-muted-foreground">
        {emptyState.description}
      </p>
    </div>
  );
}
