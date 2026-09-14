"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Clock, AlertCircle, AlertTriangle, PlayCircle, Video } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { AxonNeedsVideoCard } from "./axon-needs-video-card";
import { AdLimitExceededCard } from "./ad-limit-exceeded-card";
import { TriggerMediaPreview } from "./trigger-media-preview";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";

export interface PendingApproval {
  id: number;
  approvalToken: string;
  pausedAtNodeId: string;
  pausedAtStep: number;
  pendingActions: any;
  status: string;
  expiresAt: string;
  createdAt: string;
  automationRule: {
    id: number;
    name: string;
  };
  execution: {
    id: number;
    name: string;
    executedAt: string;
    flow: any;
  };
  flowState?: any;
}

interface ApprovalReviewDialogProps {
  approval: PendingApproval | null;
  open: boolean;
  onClose: (wasApproved: boolean) => void;
}

export function ApprovalReviewDialog({ approval, open, onClose }: ApprovalReviewDialogProps) {
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showRejectComment, setShowRejectComment] = useState(false);

  if (!approval) return null;

  const expiresAt = new Date(approval.expiresAt);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const pendingActions = approval.pendingActions || [];
  const isNeedsVideo = Array.isArray(pendingActions) && pendingActions[0]?.type === "axon_needs_video";
  const needsVideoAction = isNeedsVideo ? pendingActions[0] : null;
  const isAdLimitExceeded = Array.isArray(pendingActions) && pendingActions[0]?.type === "ad_limit_exceeded";
  const adLimitAction = isAdLimitExceeded ? pendingActions[0] : null;

  const handleAdLimitResumeSuccess = async () => {
    try {
      await fetch("/api/automation/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: approval.approvalToken,
          action: "approve",
        }),
      });
    } catch {
      // Non-critical — the resume already succeeded
    }
    setTimeout(() => onClose(true), 1500);
  };

  const handleVideoLaunchSuccess = async (adBatchId: number) => {
    // Mark the approval as approved after successful video upload + launch
    try {
      await fetch("/api/automation/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: approval.approvalToken,
          action: "approve",
        }),
      });
    } catch {
      // Non-critical — the launch succeeded regardless
    }
    // Close dialog and refresh the list
    setTimeout(() => onClose(true), 1500);
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      // First approve
      const approveResponse = await fetch("/api/automation/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: approval.approvalToken,
          action: "approve",
        }),
      });

      const approveResult = await approveResponse.json();

      if (!approveResult.success) {
        toast.error(approveResult.error || "Failed to approve");
        setProcessing(false);
        return;
      }

      // Close dialog immediately — resume runs in the background
      toast.success("Automation approved — resuming in background");
      onClose(true);

      // Fire and forget resume (actions may take seconds/minutes to execute)
      fetch("/api/automation/approval/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalToken: approval.approvalToken }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            toast.success("Automation resumed and completed");
          } else {
            toast.error("Resume failed: " + result.error);
          }
        })
        .catch(() => {
          toast.error("Failed to resume automation");
        });
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectComment) {
      setShowRejectComment(true);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/automation/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: approval.approvalToken,
          action: "reject",
          comment: comment || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Automation rejected");
        onClose(true);
      } else {
        toast.error(result.error || "Failed to reject");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setComment("");
    setShowRejectComment(false);
    onClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAdLimitExceeded ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Ad Set Limit Exceeded
              </>
            ) : isNeedsVideo ? (
              <>
                <Video className="h-5 w-5 text-amber-500" />
                Video Required for AppLovin Launch
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Review Approval Request
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAdLimitExceeded
              ? "Select ads to delete from the ad set, or skip to let Facebook decide."
              : isNeedsVideo
                ? "Upload a video to complete the AppLovin launch, or reject to cancel."
                : "Review the pending actions and approve or reject this automation."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Automation Info */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{approval.automationRule.name}</h4>
                <p className="text-sm text-muted-foreground">Execution ID: {approval.execution.id}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Started{" "}
                    {formatDistanceToNow(new Date(approval.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <Badge variant={isExpiringSoon ? "destructive" : "secondary"} className="mt-1">
                  Expires {format(expiresAt, "MMM d, h:mm a")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Trigger Media Preview */}
          {!isAdLimitExceeded && !isNeedsVideo && approval.flowState && (
            <TriggerMediaPreview flowState={approval.flowState} executionFlow={approval.execution.flow} />
          )}

          {/* Pending Actions Preview or Special Cards */}
          {isAdLimitExceeded && adLimitAction ? (
            <AdLimitExceededCard
              adSetId={adLimitAction.adSetId}
              accountId={adLimitAction.accountId}
              currentAdCount={adLimitAction.currentAdCount}
              maxAds={adLimitAction.maxAds}
              adsToLaunch={adLimitAction.adsToLaunch}
              adsToDelete={adLimitAction.adsToDelete}
              existingAds={adLimitAction.existingAds || []}
              executionId={approval.execution.id}
              onResumeSuccess={handleAdLimitResumeSuccess}
              autoSplitInfo={adLimitAction.autoSplitInfo}
            />
          ) : isNeedsVideo && needsVideoAction ? (
            <AxonNeedsVideoCard
              imageOnlyAds={needsVideoAction.imageOnlyAds || []}
              actionConfig={needsVideoAction.actionConfig || {}}
              executionId={approval.execution.id}
              onLaunchSuccess={handleVideoLaunchSuccess}
            />
          ) : (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                Pending Actions
              </h4>
              <ScrollArea className="h-[200px] rounded-lg border">
                <div className="p-4 space-y-3">
                  {Array.isArray(pendingActions) && pendingActions.length > 0 ? (
                    pendingActions.map((action: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {normalizeAdscanEventForDisplay(action.event) || action.type || "Action"}
                          </p>
                          <p className="text-xs text-muted-foreground">{action.service || "Unknown service"}</p>
                          {action.summary && <p className="text-xs text-muted-foreground mt-1">{action.summary}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No pending action details available
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Rejection Comment */}
          {showRejectComment && (
            <div className="space-y-2">
              <Label>Rejection Reason (Optional)</Label>
              <Textarea
                placeholder="Explain why this automation is being rejected..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            {isNeedsVideo || isAdLimitExceeded ? "Close" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleReject}
              disabled={processing}
            >
              <X className="h-4 w-4 mr-2" />
              {showRejectComment ? "Confirm Reject" : "Reject"}
            </Button>
            {!isNeedsVideo && !isAdLimitExceeded && (
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={processing}>
                <Check className="h-4 w-4 mr-2" />
                Approve & Resume
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
