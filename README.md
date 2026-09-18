# Automation agent quality challenge

A standalone copy of AdManage's automation UI with mock accounts and APIs. The challenge is to **add logging and a useful dashboard, investigate customer problems, set up evals, and demonstrate a better experience that helps customers get lasting value**.

Read **[TASK.md](TASK.md)** for the full brief and **[docs/customer-cases.md](docs/customer-cases.md)** for anonymized customer problems.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm run eval          # runs evals/run.eval.test.ts — pass/fail summary + evals/results/latest.json
```

Open http://localhost:3000. No database, production accounts or API keys are required.

Open http://localhost:3000/automation/insights for the quality dashboard. Click
**Reset fixtures** there to load a seeded demo dataset with no setup, or use the
chat assistant first (Home → Chat) to generate real events from your own session.

## UI baseline

The automation home, chat entry, builder dock and assistant have been refreshed from the product's 14 September 2026 source snapshot. Start here; the exercise is to improve the customer journey and make its quality measurable.

See [docs/ui-sync.md](docs/ui-sync.md) for scope and demo adaptations.

## What is real and what is mocked

- **Interactive UI:** automation home, chat entry, canvas, step editing, assistant streaming, template gallery and workflow state.
- **Mock accounts:** one fixed demo user and workspace. No production authentication.
- **Mock storage:** three seeded automations. Save, rename, duplicate, toggle and delete use an in-memory store. Server reloads reset state.
- **Scripted assistant:** real SSE transport with scripted pause/scale responses, plus scripted repros of C01 (repeated confirmation), C02 (schedule fidelity) and the fixed C06 (platform mismatch) flow — see `lib/mock/assistant-script.ts`. It is not a production model. Unsupported prompts do not establish model-quality results.
- **Execution and integrations:** simulated or unavailable. No live ads, comments, Slack messages or provider resources are changed. Many integration-specific configuration panels remain labelled stubs.
- **Other API responses:** empty demo responses allow secondary views to render. They do not prove integration success.
- **Logging, quality dashboard and eval workflow:** these are the new challenge deliverables, not claims about features already implemented here.

## What I built

Covers three of the six customer cases — **C01** (repeated confirmation), **C02**
(schedule fidelity), **C06** (unsupported platform) — chosen for visual variety
(UX friction, data-fidelity bug, capability-boundary bug). C03/C04/C05 were
deliberately **not** investigated or fixed in this pass; see "Deliberately left
out" below.

### 1. Investigation

`docs/investigation.md` — repro steps, exact file/line for each bug, what the
transcript vs. flow state vs. execution evidence each prove, and why C06 was fixed
first (a wrong-platform action is worse than repeated text or an unconfirmed
schedule, and the fix reused existing infrastructure).

### 2. Logging

`lib/telemetry/events.ts` defines a typed event contract: `attempt_started`,
`question_asked`/`question_answered`, `tool_call_started`/`tool_call_finished`,
`draft_changed`, `preview_viewed`, `draft_saved`, `automation_activated`,
`run_succeeded`, `attempt_retried`, `attempt_abandoned`, `stream_error`, plus an
`attempt_outcome` event carrying the funnel-level result. Every event carries
`sessionId`/`attemptId`/`turnId` correlation, `flowRevision`, a mock
`promptVersion`, and an `outcome`/`errorCategory` enum.

**Real wiring, not a fixture feed:** events are emitted from
`app/(dashboard)/automation/hooks/use-automation-assistant.ts` (the actual
streaming chat path — attempt lifecycle, tool calls, retries, stream errors) and
`app/(dashboard)/automation/contexts/automation-context.tsx` (save, activate, run)
plus `full-preview-panel.tsx` (preview). Using the assistant, saving, previewing,
activating and running an automation in this app produces real, inspectable
events — try it, then open `/automation/insights`.

**Persistence:** `localStorage`, per browser tab (`lib/telemetry/store.ts`).
Chosen because it needs no server, accounts or keys, matching the brief. Capped
at 4000 events (oldest dropped). No TTL — retention ends when the browser clears
site storage or a reviewer clicks **Reset fixtures** on the dashboard. A
production sink would post the same typed events to an Axiom dataset from a
server route — see `EVENT_SINK_NOTE` in `lib/telemetry/events.ts`.

**Redaction:** raw customer prompts/questions are never stored. `redactText()` in
`lib/telemetry/store.ts` reduces any free text to `{ length, hash }` (a
dependency-free deterministic hash) before it is ever persisted — this runs in the
storage layer, not the UI, so nothing can bypass it on the way to disk.

**Duplicates/retries:** `recordEvent` de-duplicates by `eventId`, so a replayed
SSE delivery cannot double-count. Internal stream retries (the hook's own
transient-drop retry loop) and a genuine user "confirm again" both reuse the same
`attemptId`, so the dashboard can distinguish "the network hiccuped" from "the
customer tried three times."

**Reset fixtures:** the dashboard's **Reset fixtures** button
(`lib/telemetry/fixtures.ts` → `resetToFixtures`) wipes local storage and loads a
seeded dataset covering all three cases plus a before/after pair for C06 — no
accounts or keys needed to see a populated dashboard.

### 3. Dashboard

`app/(dashboard)/automation/insights/page.tsx` (visit `/automation/insights`):
funnel (prompt → draft → preview → save → activate → successful run) with counts
per stage; filters by problem category, platform, outcome, source (live vs.
fixture) and time range; a clickable attempt list opening a full timeline (every
typed event, redacted); a review-label + **Convert to eval** action that exports a
sanitized JSON fixture; and a dedicated before/after card for the C06 fix. Loading,
empty (no data yet → "load demo fixtures"), no-results (filters too narrow) and
error (storage read failed → retry) states are all implemented, not stubbed.
"Simulated" run evidence is labeled as such everywhere (`run_succeeded.evidence`)
— a seeded successful run is never presented as proof a live ad changed.

### 4. Eval suite

`evals/` — `pnpm run eval` runs `evals/run.eval.test.ts` against
`evals/fixtures.ts` (dataset version in `evals/types.ts`), calling `buildMockTurn`
directly (no server, no network, no API key). Produces a human-readable pass/fail
summary in the terminal and a machine-readable result at
`evals/results/latest.json`. Covers: a successful **control** case (so a
"refuse everything" agent cannot pass), a **held-out regression** case unrelated
to C01/C02/C06, the **C06 fix** (asserted as fixed), and **C01**/**C02** as
explicitly documented known-limitation cases whose assertions describe the current
(buggy) behavior rather than the desired one — see the comments in
`evals/fixtures.ts` for exactly what would need to flip once they're fixed. No
model judge is used; every assertion is deterministic (tool names, service
strings, substring presence/absence, closing-text equality).

### 5. Improvement: C06 platform mismatch

`docs/improvement.md` has the full before/after. Summary: `buildMockTurn` in
`lib/mock/assistant-script.ts` now detects when the requested platform doesn't
match the selected account's platform, asks via the app's existing `ask_user`
inline-picker UI (no new component — reused
`app/chat/components/cards/QuestionCard.tsx`) listing connected accounts for the
requested platform, and only builds once answered — instead of silently building
a Meta action for a Pinterest request. `automation-context.tsx` remains the single
source of truth for flow state; nothing here forks it.

### Production experiment (not run here)

**Mechanism:** fewer abandoned clarification loops (C01/C06) and fewer silently
wrong drafts (C02/C06) → more attempts reach `draft_saved` → more saved
automations reach `run_succeeded`.

**Metric:** activation = an eligible attempt (first `attempt_started` in a 28-day
observation window) reaching `run_succeeded` within 7 days; repeat value =
`run_succeeded` recurring at least twice, 7+ days apart, within the 28-day window.
Eligible cohort = sessions with at least one `attempt_started` in the window,
explicit denominator = count of such sessions (not all sessions, since a customer
who never opened the assistant hasn't had a chance to activate). A customer whose
28-day window hasn't elapsed yet is excluded from the denominator, not counted as
churned.

**Experiment:** an A/B on the C06 mismatch-detection logic (on vs. off) gated
behind a feature flag, guardrailed on stream error rate and p95 turn latency (the
extra `ask_user` round trip adds a turn) — ship only if activation improves without
a latency or error-rate regression outside the guardrail. Offline eval scores and
this demo's fixture data cannot establish a real lift; they only show the
mechanism behaves as designed.

### Deliberately left out

- **C03 (invisible template) and C05 (incomplete flow):** not investigated or
  fixed in this pass — see TASK.md's "do a coherent slice well" guidance. Left as
  fixture-shaped gaps for the same `evals/types.ts` schema to extend later.
- **C04 (draft preservation regression):** the brief frames it as "recheck, not a
  claim it remains broken" — not independently re-verified here.
- **A model judge** for clarity/helpfulness — optional per the brief; the default
  suite runs without one and without API keys.
- **Any production Axiom integration** — this stays local-only; see
  `EVENT_SINK_NOTE` in `lib/telemetry/events.ts` for where it would attach.
- **Cross-tab/cross-device telemetry sync** — `localStorage` is per browser tab;
  a second tab or device starts its own session.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/automation/` | Home, chat, builder, hooks and flow state |
| `app/(dashboard)/automation/insights/page.tsx` | Quality dashboard (funnel, filters, attempt timelines, review → eval) |
| `app/api/` | Mock API endpoints |
| `lib/mock/` | Demo user adapters, scripted assistant and automation store |
| `lib/telemetry/` | Typed event contract, local persistence, redaction, fixtures |
| `evals/` | Versioned eval dataset + runnable suite (`pnpm run eval`) |
| `components/ui/` | Shared UI controls |
| `docs/customer-cases.md` | Sanitized problems and suggested eval checks |
| `docs/investigation.md` | C01/C02/C06 repro, diagnosis, prioritization |
| `docs/improvement.md` | C06 fix before/after and eval evidence |
| `TASK.md` | Deliverables and review criteria |

Service logos are third-party trademarks used to identify integrations. All demo metrics and outcomes must be labelled as simulated when used in your submission.
