"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Youtube } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  canCancel,
  canRetry,
  describeQueueDestination,
  describeQueueStatus,
  describeQueueWait,
  queueRowWatchUrl,
  summarizeQueue,
  type QueueRow,
  type QueueTone,
} from "@/lib/youtube/automation-queue/queue-row-view";

/** Refreshes often enough that a minute-paced queue looks alive. */
const POLL_MS = 20_000;

const TONE_CLASS: Record<QueueTone, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bad: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  muted: "bg-muted text-muted-foreground line-through",
};

interface YouTubeUploadQueuePanelProps {
  /**
   * Show an explanatory empty state instead of rendering nothing.
   *
   * On its own tab an empty queue must say so — a blank page reads as broken.
   * Embedded in another view it should stay invisible until there is something
   * to report.
   */
  showEmptyState?: boolean;
}

export function YouTubeUploadQueuePanel({ showEmptyState = false }: YouTubeUploadQueuePanelProps) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch("/api/automation/youtube-queue");
      if (!response.ok) return;
      const data = (await response.json()) as { rows?: QueueRow[] };
      setRows(data.rows ?? []);
    } catch {
      // Leave the last good view up rather than blanking the table on a blip.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function act(itemId: number, action: "cancel" | "retry") {
    setBusyItem(itemId);
    try {
      const response = await fetch("/api/automation/youtube-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, action }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(data.error || `Could not ${action} that upload`);
      } else {
        toast.success(action === "cancel" ? "Upload canceled" : "Upload queued again");
      }
      await load();
    } catch {
      toast.error(`Could not ${action} that upload`);
    } finally {
      setBusyItem(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-24 w-full" />
      </Card>
    );
  }

  if (rows.length === 0) {
    if (!showEmptyState) return null;
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Youtube className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2 text-lg">Nothing in the upload queue</CardTitle>
          <CardDescription className="max-w-sm text-center">
            Videos queued by an &ldquo;Upload to YouTube&rdquo; automation step appear here, with what they are waiting
            on and how many attempts are left.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const summary = summarizeQueue(rows);
  const now = new Date();

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Youtube className="h-4 w-4 text-red-600" />
            YouTube uploads
          </CardTitle>
          <CardDescription className="text-xs">
            {summary.waiting} waiting · {summary.uploading} uploading · {summary.uploaded} uploaded
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}. Paced to stay inside your daily automation
            budget.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh queue">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="px-0 pt-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next attempt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = describeQueueStatus(row);
                const busy = busyItem === row.itemId;
                return (
                  <TableRow key={row.itemId}>
                    <TableCell className="font-medium">
                      {queueRowWatchUrl(row) ? (
                        <a
                          href={queueRowWatchUrl(row) as string}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {row.fileName}
                        </a>
                      ) : (
                        row.fileName
                      )}
                      {row.errorText && row.status === "failed" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.errorText}</p>
                      )}
                      {row.status === "succeeded" && row.videoId && (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.videoId}</p>
                      )}
                      {row.status === "succeeded" && !row.videoId && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Reported success but returned no video id — nothing was created on the channel.
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{describeQueueDestination(row)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("font-normal", TONE_CLASS[status.tone])}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{describeQueueWait(row, now)}</TableCell>
                    <TableCell className="text-right">
                      {canCancel(row) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void act(row.itemId, "cancel")}
                        >
                          Cancel
                        </Button>
                      )}
                      {canRetry(row) && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(row.itemId, "retry")}>
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
