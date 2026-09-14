import { isMetaTargetAdSetMissing } from "@/app/(dashboard)/automation/components/config-sections/target-ad-set-validation";
import type { SetupIssue, SetupNode } from "./setup-validation";
import { normalizeGoogleSheetsColumnMappings } from "./google-sheets-column-mappings";

const ID_FIELDS = new Set([
  "targetIds",
  "targetId",
  "targetAdIds",
  "adIdsToPause",
  "adIdsToEnable",
  "sourceAdIds",
  "sourceAdId",
  "targetAdSetIds",
  "targetAdSetId",
  "sourceAdSetId",
  "targetCampaignIds",
  "targetCampaignId",
  "sourceCampaignId",
  "selectedAdIds",
  "selectedAdSetIds",
  "selectedCampaignIds",
  "specificTargetAdSets",
]);
const QUALIFYING_FIELDS = new Set([
  "qualifyingAdIds",
  "qualifyingAdSetIds",
  "qualifyingCampaignIds",
  "qualifyingEntityIds",
  "qualifyingAdGroupIds",
]);
const NO_MEDIA_TRIGGERS = new Set([
  "scheduled",
  "manual",
  "meta-ads",
  "tiktok-ads",
  "axon-ads",
  "google-ads",
  "snapchat-ads",
  "pinterest-ads",
]);

function values(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value))
    return value.flatMap((item) =>
      typeof item === "object" && item !== null && "id" in item ? values(item.id) : values(item),
    );
  return [];
}

/** Statically provable producer/consumer mismatches from the failure-channel audit. */
export function getTargetSetupIssues(nodes: readonly SetupNode[], accountId?: string | null): SetupIssue[] {
  const issues: SetupIssue[] = [];
  for (const [index, node] of nodes.entries()) {
    const config = node.config ?? {};
    const previous = nodes.slice(0, index);
    const trigger = previous.find((n) => n.type === "trigger");
    const add = (message: string) =>
      issues.push({ nodeId: node.id ?? "", message: `${node.event || "Step"}: ${message}` });
    if (node.type === "action" && /-ads$/.test(node.service ?? "")) {
      for (const field of ID_FIELDS) {
        for (const value of values(config[field])) {
          if (/\}\}[\s\S]*\{\{/.test(value)) {
            add(
              "choose one ID data pill per target field. Combining pills can merge IDs or silently ignore later values.",
            );
            continue;
          }
          const match = value.match(/^\{\{\s*([^.{}]+)\.([^{}]+?)\s*\}\}$/);
          if (!match) continue;
          const [, sourceId, output] = match;
          const source = previous.find((n) => n.id === sourceId) ?? (sourceId === "trigger" ? trigger : undefined);
          if (!source) {
            add(`the target data pill references a missing or later step. Choose an ID output from an earlier step.`);
            continue;
          }
          if (
            /(?:Count|Checked|Name|Names)$/.test(output!) ||
            output === "qualifyingAds" ||
            output === "qualifyingEntities"
          ) {
            add(
              `“${output}” is a count, name, or record list, not an ID. Choose the matching ad, ad set, or campaign ID output.`,
            );
          }
          if (QUALIFYING_FIELDS.has(output!) && !/-ads$/.test(source.service ?? "")) {
            add(
              `the referenced ${source.event || "step"} does not output qualifying ad IDs. Use the ID created by a duplication step instead.`,
            );
          }
          const targetKind = /AdSet|adSet/.test(field)
            ? "adset"
            : /Campaign|campaign/.test(field)
              ? "campaign"
              : /AdIds|AdId|adIds/.test(field)
                ? "ad"
                : null;
          const outputKind =
            output === "qualifyingAdSetIds"
              ? "adset"
              : output === "qualifyingCampaignIds"
                ? "campaign"
                : output === "qualifyingAdIds"
                  ? "ad"
                  : null;
          if (targetKind && outputKind && targetKind !== outputKind)
            add(
              `the ${field} field needs ${targetKind === "adset" ? "ad set" : targetKind} IDs; this pill supplies ${outputKind === "adset" ? "ad set" : outputKind} IDs.`,
            );
        }
      }
    }
    if (
      node.type === "action" &&
      node.service === "meta-ads" &&
      ["Launch Ad", "Duplicate Ad"].includes(node.event ?? "")
    ) {
      const hasScalePlan = previous.some(
        (n) =>
          n.service === "meta-ads" &&
          ["Duplicate Ad Set", "Duplicate Campaign"].includes(n.event ?? "") &&
          n.config?.scaleQualifyingStructure === true,
      );
      const hasCampaignDestination =
        node.event === "Duplicate Ad" &&
        (values(config.targetCampaignId).length ||
          values(config.specificTargetCampaigns).length ||
          values(config.targetCampaignNameFilter).length);
      if (!hasScalePlan && !hasCampaignDestination && isMetaTargetAdSetMissing(node.service, node.event!, config))
        add("choose a destination ad set, a name filter, or an ad set ID from an earlier step before enabling.");
    }
    if (
      node.service === "media-library" &&
      node.event === "Upload to Media Library" &&
      trigger &&
      NO_MEDIA_TRIGGERS.has(trigger.service ?? "")
    ) {
      add(
        "this trigger supplies performance or schedule data, not files. Choose a file/media trigger before uploading to the media library.",
      );
    }
    if (
      node.service === "google-ads" &&
      node.event === "Upload to YouTube" &&
      trigger &&
      NO_MEDIA_TRIGGERS.has(trigger.service ?? "")
    ) {
      add(
        "this trigger supplies performance or schedule data, not files. Choose a file/media trigger before uploading to YouTube.",
      );
    }
    if (node.service === "google-sheets") {
      if (!values(config.spreadsheetId).length) add("choose a spreadsheet and an existing tab before enabling.");
      if (
        node.type === "action" &&
        ["Add Row", "Update Row"].includes(node.event ?? "") &&
        normalizeGoogleSheetsColumnMappings(config.columnMappings).length === 0
      )
        add("configure at least one column mapping before enabling.");
    }
    if (node.service === "frameio" && node.type === "trigger") {
      if (!values(config.frameioAccountId).length || !values(config.folderId).length)
        add("choose a Frame.io account and folder before enabling.");
    }
    if (
      node.type !== "action" ||
      !["meta-ads", "tiktok-ads"].includes(node.service ?? "") ||
      !/^(Pause|Enable) (Ad|Ad Set|Campaign|Ad Group)$/.test(node.event ?? "")
    )
      continue;
    const kind = /Campaign$/.test(node.event!)
      ? "campaign"
      : /Ad Set$/.test(node.event!)
        ? "adset"
        : /Ad Group$/.test(node.event!)
          ? "adgroup"
          : "ad";
    const keys =
      kind === "campaign"
        ? ["targetCampaignIds", "targetIds", "selectedCampaignIds"]
        : kind === "adset" || kind === "adgroup"
          ? ["targetAdSetIds", "targetAdGroupIds", "targetIds", "selectedAdSetIds", "selectedAdGroupIds"]
          : [node.event === "Pause Ad" ? "adIdsToPause" : "adIdsToEnable", "targetAdIds", "targetIds", "selectedAdIds"];
    const targets = keys.flatMap((key) => values(config[key]));
    const label = kind === "adset" ? "ad set" : kind === "adgroup" ? "ad group" : kind;
    const samePlatformTrigger =
      trigger?.service === node.service &&
      ["Performance Threshold", "Performance Monitoring"].includes(trigger?.event ?? "");
    if (!targets.length && !samePlatformTrigger)
      add(`select target ${label} IDs or use a matching performance trigger.`);
    if (
      !targets.length &&
      samePlatformTrigger &&
      trigger?.event === "Performance Monitoring" &&
      (trigger.config?.monitoringLevel || "account") !== kind
    )
      add(`the monitoring trigger does not supply ${label} IDs. Match its monitoring level to this action.`);
    const accounts = [accountId, config.accountId, config.advertiserId]
      .filter(Boolean)
      .map((id) => String(id).replace(/^act_/, ""));
    if (targets.some((id) => !id.includes("{{") && (id.startsWith("act_") || accounts.includes(id))))
      add(`an ad account ID cannot be used as a ${label} target. Choose ${label} IDs.`);
  }
  return issues;
}
