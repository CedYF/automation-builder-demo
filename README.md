# Automation agent take-home

You are joining the team that owns the AdManage automation builder. Customers describe an automation to "Ada", review the flow she drafts, then save and turn it on. This repo is a runnable copy of that experience on mock data. It has two jobs for you:

1. **Improve the builder UI** so people know what was built and trust it.
2. **Build a dashboard** that shows how healthy the agent is and what to fix next.

Everything runs offline. No accounts, no API keys, no calls to Axiom, Slack or Meta.

## Why this matters (evidence)

From the automation-agent feedback channel, anonymized and paraphrased. This is observed conversation behaviour, not verified provider execution.

1. **Comment moderation is the most common use.** Hide or delete negative comments, reply to FAQ comments, hide comments that name a competitor. Scheduled pause and activate rules are second ("pause ads under CHF 5 spend in 7 days", "run Friday 11pm, stop 12am Saturday").
2. **Four or more customers asked "explain what this automation does"** right after the agent built it. The builder never states what was built, what state it is in (drafted, saved, active, blocked) or what to do next. This is the core UI problem.
3. **Repeated failures:** the same message processed two to four times (the client retries a dropped stream with no per-turn id), a Pinterest request on a Meta account raised three times by one customer, and schedule or timezone details lost between turns.

The cases are written up in [docs/customer-cases.md](docs/customer-cases.md).

## Run it

```bash
pnpm install --frozen-lockfile
pnpm dev            # http://localhost:3000 (Next picks the next free port if it is taken)
pnpm typecheck && pnpm test && pnpm build
pnpm fixtures:generate   # rewrites fixtures/axiom-events.ndjson (Node 22.18+)
```

Open **Automate → Chat**, pick "Demo Store — UK" (a fictional Meta account) and try the prompts below. Mock automations live in memory and reset when the dev server restarts.

## The baseline problems (reproduce these first)

The scripted assistant reproduces today's bad behaviour on purpose. **Do not treat these as bugs in the mock.** They are the baseline you are improving.

| # | Type this in Chat | What happens today | Why it is a problem |
| --- | --- | --- | --- |
| 1 | `Hide negative comments` | Builds *New Comment (negative) → Hide Comment*. Header says **Unsaved draft**, assistant says "Your automation is **live**". | Nothing says what was built, and the state is contradicted. Customers ask "what does this do?" |
| 2 | `Reply to FAQ comments` | Asks which page three times, then builds. Reply with anything each time. | A clarification loop for information the account already implies. |
| 3 | `Pause my Pinterest ads that spent under $5` | Silently builds a **Meta** pause action and says "your **Pinterest** ads will be paused". | Platform mismatch presented as success. |
| 4 | `Hide comments that mention CompetitorCo` | The first connection drops, the client auto-retries, and the **summary appears twice**. | Retries are not idempotent. Nothing marks the second summary as a repeat. |
| 5 | `Pause ads under CHF 5 spend in the last 7 days, run Friday 23:00 and stop at 00:00 Saturday`, then answer `Zurich time` | First turn keeps Friday 23:00 but ignores the stop time and asks for a timezone. Your answer **rebuilds the rule daily at 09:00**. | The requested schedule is lost and no field records a timezone. |

Two saved automations are seeded too: **Hide negative comments** (active) and **Pause low-spend ads (Friday 23:00)** (draft).

Server state for scenarios 2 to 5 is per conversation and resets with the dev server. The responder is `lib/mock/assistant-script.ts`; the stream and the dropped connection are in `app/api/automation-assistant/stream/route.ts`.

### Screenshots

Before/after screenshots are part of your submission. This repo's starter ships **without** baseline screenshots: the tooling used to prepare it could view pages but could not save image files. Capture your own for scenarios 1, 3 and 4 before you change anything, save them under `docs/screenshots/`, and reference them from your write-up.

## Part 1: make it clear what was built

Improve the builder and the assistant so a customer always knows what they have and can act on it. Checklist:

- [ ] **(a) Plain-language summary, always visible.** Trigger, filter, actions, schedule and timezone, e.g. "When a new comment on Demo Store is negative, hide it."
- [ ] **(b) Separate, labelled states:** Drafted, Saved, Active, Last run, Blocked. Mark each one **observed**, **simulated** or **unknown**. A seeded run is not proof that a live ad or comment changed.
- [ ] **(c) "Needs attention" items** with the reason and a one-click next action: platform mismatch, missing timezone, unresolved account or template.
- [ ] **(d) No duplicate final summaries on retry.**
- [ ] **(e) Loading, empty and error states** for the new surfaces.
- [ ] **(f) Before/after screenshots and a short walkthrough.**

Keep `app/(dashboard)/automation/contexts/automation-context.tsx` as the single source of truth for flow state. Save, rename, preview and activate must keep working within the mock's limits.

## Part 2: a dashboard for agent health

Build a page that reads the mock Axiom-shaped events and tells a product engineer what to fix next.

- [ ] Funnel: prompt → draft → preview → save → activate → successful run, with the drop-off at each step.
- [ ] Top failure categories **ranked by customers affected**, deduplicating retries by `attemptId`.
- [ ] Filters: category, platform, outcome, time range.
- [ ] Open a conversation and read its timeline.
- [ ] A **"fix next"** recommendation with the reasoning behind it.
- [ ] Loading, empty, no-results and error states.
- [ ] A before/after comparison (baseline against your change, with sample sizes).
- [ ] A short note on how a real Axiom sink would attach.

### Data you get

`fixtures/axiom-events.ndjson` has **373 events across 40 conversations**, deterministic and regenerable with `pnpm fixtures:generate`. It is simulated. Problems are planted for you to find, not labelled for you:

- duplicate deliveries of one turn under different `attemptId`s
- Pinterest requests on Meta accounts that finish "successfully"
- repeated "explain what this does" from several customers
- schedule and timezone losses
- customers who stop before save, and before activate

Each event follows the `automation-agent` dataset shape in `lib/logging/types.ts`: `_time`, `conversationId`, `turnId`, `attemptId`, hashed `userIdHash`, `workspaceId`, `accountPlatform`, `requestedPlatform`, `event`, `tool`, `durationMs`, `outcome`, `errorCategory`, `flowRevision`, `model`, `promptVersion`. `event` names cover the funnel plus `tool_call`, `clarification_*`, `stream_retry`, `turn_error` and `explain_requested`.

### Logging you get, and what you add

`lib/logging/` provides `logEvent()`, a memory sink, a `localStorage` sink and an **unimplemented `AxiomSink` stub** that marks where a production sink attaches (server side, hashed user id, batched ingest). Nothing is sent anywhere.

Emission is intentionally not wired up. Search for `TODO(candidate)` to find the five marked points: stream attempt and retry, turn end, save, activate, and server tool calls. Wiring them and choosing what else to capture is part of the exercise.

## How you will be evaluated

| Area | What we look for |
| --- | --- |
| Customer understanding | Names the real friction without inventing execution outcomes. |
| UI | Someone new can say what was built, in what state, and what to do next. |
| Dashboard | The next thing to fix is obvious, and counts dedupe retries. |
| Data honesty | Observed, simulated and unknown are never blurred. |
| Engineering | Typed, small, tested; follows the repo's conventions; still builds offline. |
| Judgment | A clear priority, with what you left out and why. |

## Time-box

3 to 4 hours. Do one coherent slice well: for example the summary and state panel for scenarios 1 and 4, plus a funnel and a ranked failure list. A polished partial result beats a sprawling one.

## Out of scope

Real Axiom, Slack or Meta calls; auth and billing; a general observability platform; fixing every case; retention claims from mock data; new visual design systems.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/automation/` | Home, chat, builder, assistant hook, flow state |
| `app/api/automation-assistant/stream/route.ts` | Mock SSE stream, conversation state, dropped connection |
| `lib/mock/` | Scripted assistant, in-memory automation store |
| `lib/logging/` | Event types, `logEvent`, sinks, fixture generator |
| `fixtures/axiom-events.ndjson` | Simulated event export |
| `docs/customer-cases.md` | Sanitized customer problems |
| `docs/ui-sync.md` | Which product changes are included or left out |

Service logos are third-party trademarks used to identify integrations. All demo metrics and outcomes are simulated.
