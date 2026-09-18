"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Stand-in for a config section that was not ported into this demo.
 *
 * The real app has 51 of these. Most are bound to a live platform API (Meta ad
 * accounts, TikTok identities, Google Sheets and Drive pickers, Frame.io, Notion),
 * so reproducing them without credentials would mean faking a dozen integrations
 * for no benefit to the task in README.md.
 *
 * They are stubbed rather than deleted so `config-panel.tsx` keeps the exact
 * routing shape it has in production: every trigger and action the registry can
 * produce still resolves to a section, and the panel's switch is unchanged.
 */
export function createNotPortedConfig(sectionName: string, sourceFile: string) {
  // Props are intentionally open: config-panel passes a different shape to each
  // section (some take flowNodes, some a platform, some a ruleId). Accepting all
  // of them keeps the panel's call sites byte-identical to the real file.
  function NotPortedConfig(_props: Record<string, unknown>) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-amber-900">{sectionName} is not part of this demo</p>
            <p className="text-xs leading-relaxed text-amber-800">
              In the full app this section lives in{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">{sourceFile}</code> and talks to
              a live platform API. The node, its registry entry and its place in the flow are all real — only this form
              is stubbed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  NotPortedConfig.displayName = sectionName;
  return NotPortedConfig;
}
