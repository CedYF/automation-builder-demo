"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, CircleAlert, Square } from "lucide-react";
import type { AssistantMessage, AssistantToolCall } from "../hooks/use-automation-assistant";

export function describeAssistantActivity(call: AssistantToolCall): string {
  const event = typeof call.args.event === "string" ? call.args.event : null;
  switch (call.name) {
    case "automation_start_flow":
      return "Preparing the draft";
    case "automation_add_step":
      return event ? `Adding ${event}` : "Adding a workflow step";
    case "automation_update_step":
      return event ? `Updating ${event}` : "Updating a workflow step";
    case "automation_remove_step":
      return "Removing a workflow step";
    case "scan_account_insights":
      return "Reviewing account performance";
    case "list_pages":
    case "resolve_pages_by_name":
      return "Finding your Facebook and Instagram pages";
    case "list_ad_accounts":
    case "resolve_ad_accounts_by_name":
      return "Finding connected ad accounts";
    case "preview_performance_threshold":
      return "Checking which ads match";
    case "ask_user":
      return "Preparing a question for you";
    default:
      return "Checking workflow details";
  }
}

export function AssistantLiveActivity({ message, busy }: { message?: AssistantMessage; busy: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!busy) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy, message?.id]);
  if (!message?.startedAt) return null;
  const seconds = Math.max(0, Math.floor((busy ? now - message.startedAt : (message.durationMs ?? 0)) / 1000));
  const running = [...message.toolCalls]
    .reverse()
    .find((call) => call.status === "running" || call.status === "queued");
  const failed = message.outcome === "failed" || message.toolCalls.some((call) => call.status === "error");
  const cancelled = message.outcome === "cancelled";
  const asking = message.toolCalls.some((call) => call.name === "ask_user" && call.status === "done");
  if (!busy && !failed && !cancelled && !asking) return null;
  const complete = message.toolCalls.filter((call) => call.status === "done").length;
  const label = busy
    ? running
      ? describeAssistantActivity(running)
      : "Working on your request"
    : cancelled
      ? "Stopped — draft changes kept"
      : failed
        ? "Needs attention"
        : asking
          ? "Waiting for your answer"
          : "Response complete";
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-2" role="status">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        ) : cancelled ? (
          <Square className="h-3.5 w-3.5" />
        ) : failed ? (
          <CircleAlert className="h-3.5 w-3.5 text-amber-600" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        <span className="flex-1">{label}</span>
        <span className="tabular-nums text-muted-foreground" aria-live="off">
          {seconds}s
        </span>
      </div>
      {busy && seconds >= 15 && (
        <p className="mt-1 text-muted-foreground">
          {complete ? `${complete} checks or edits completed. ` : ""}You can keep typing or stop to correct the request.
        </p>
      )}
    </div>
  );
}
