# Investigation: C01, C02, C06

Scope for this pass: three of the six customer cases in `docs/customer-cases.md` —
C01 (repeated confirmation), C02 (schedule fidelity), C06 (unsupported platform).
C03/C04/C05 were **not** investigated or fixed here; see the README's "left out"
section.

For each case: how it was reproduced, what broke and where (file/line), what the
transcript vs. flow state vs. execution evidence each actually prove, and — at the
end — which one was fixed first and why.

## Method

The scripted responder (`lib/mock/assistant-script.ts`) originally only handled two
intents ("pause" and "scale"), so none of C01/C02/C06 could be reproduced at all
before this pass. I extended the script with minimal, clearly-marked detection for
each case (see `buildMockTurn`) so the *existing* customer-reported behavior could
actually be exercised end to end through the real streaming route
(`app/api/automation-assistant/stream/route.ts`) and the real client hook
(`use-automation-assistant.ts`) — not a separate simulation. The eval suite
(`evals/fixtures.ts`) then pins down the exact assertions.

## C01 — repeated confirmation

**Repro:** `evals/fixtures.ts` → `c01-repeated-confirmation`. Send "pause my
rejected tiktok ads" with the TikTok account already selected
(`accountPlatform: "tiktok"`), then reply "build" twice.

**What breaks, and where:** `lib/mock/assistant-script.ts`, `isConfirmationOnly()`
+ the `isConfirmationOnly(message)` branch in `buildMockTurn`. The scripted
responder is stateless per HTTP request — it has no memory of "I already built
this." A confirmation-only reply re-runs `pauseTurn(...)` from scratch: the same
`automation_start_flow` / `automation_add_step` tool calls fire again, and the
closing text is byte-identical to the first turn's. This mirrors the customer
report precisely: "described a completed draft, then repeated the same
save/activate instructions multiple times after the customer said 'build.'"

**Transcript vs. flow state vs. execution evidence:**
- The **transcript** proves the assistant asked for confirmation once, then gave
  the same closing summary on each subsequent "build." It does not prove whether
  the customer understood a draft already existed.
- The **flow state** (`automation-context.tsx`'s `flow.nodes`) is not corrupted by
  this bug — each replay reconstructs the same three nodes, so the *canvas* ends
  up correct. The damage is in the conversation, not the data: the customer has no
  signal that "build" #2 and #3 did nothing new.
- **Execution evidence** — whether the automation was ever actually saved — is
  never established by either. `draft_saved` / `automation_activated` telemetry
  events (see `lib/telemetry/events.ts`) are what would answer "did the customer
  ever actually save this," and they are absent from this repro because the
  scripted turns never call `saveAutomation`. The eval's `c01-repeated-confirmation`
  case documents the conversational bug; it makes no claim about persistence.

**Not fixed this pass.** See "Prioritization" below.

## C02 — schedule fidelity

**Repro:** `evals/fixtures.ts` → `c02-schedule-fidelity`. Send "Set up a Sheets
automation to launch new rows every Monday, Tuesday and Wednesday at 9am EEST."

**What breaks, and where:** `lib/mock/assistant-script.ts`, `sheetsScheduleTurn()`.
The trigger step is built with `config: { checkFrequency: "daily", checkTime:
"09:00" }` — no `checkDays` array, no timezone field at all. The closing text then
asks for an unrelated "source ad set ID" instead of confirming (or asking to
clarify) the requested schedule. The eval asserts the closing text contains **none**
of "monday"/"tuesday"/"wednesday"/"eest" — today that assertion passes, i.e. the
bug is confirmed present.

**Transcript vs. flow state vs. execution evidence:**
- The **transcript** proves the agent asked about a source ad set, not about the
  schedule — the customer has no visible acknowledgement of Mon/Tue/Wed or EEST.
- The **flow state** is the concrete evidence of data loss: `node-trigger-1.config`
  genuinely lacks `checkDays` and any timezone key. This is not a UI rendering gap —
  the information was never captured into the draft, so nothing downstream (Save,
  Preview, the real `polling-run-time.ts` scheduler) can recover it.
- **Execution evidence** is irrelevant here — the bug is fully provable from flow
  state alone, no live run required. This is the strongest of the three repros
  precisely because it does not depend on inferring customer intent from prose.

**Not fixed this pass.**

## C06 — unsupported platform

**Repro:** `evals/fixtures.ts` → `c06-unsupported-platform`. Send "switch off
specific pinterest ads" with a Meta account selected.

**What broke, and where (baseline):** before this pass, `buildMockTurn` had no
platform-awareness at all — `wantsPause("...pinterest ads")` matches on "switch
off," and the script would have built a **Meta** pause automation while the
customer's text said Pinterest, with nothing calling that out. `docs/improvement.md`
has the full before/after.

**Transcript vs. flow state vs. execution evidence:**
- The **transcript** (baseline) shows the agent describing a completed build
  without ever naming a platform mismatch — the customer has no way to know the
  automation isn't touching Pinterest.
- The **flow state** (baseline) is the smoking gun: `node-trigger-1.service` /
  `node-action-1.service` are `"meta-ads"`, `selectedAccountId` is the Meta account
  — a structurally valid automation for the *wrong* platform.
- **Execution evidence** would show the automation running against Meta ads that
  were never the customer's Pinterest ads at all — but we don't need it to prove
  the bug; the flow state alone shows a Meta action was built for a Pinterest
  request.

**Fixed this pass** — see `docs/improvement.md`.

## Prioritization: which one would I fix first, and why

**C06 first (done).** It is a capability-boundary bug, not a UX-polish bug: the
agent silently does the *wrong thing* to what may be a live ad account, and the
customer has no way to detect it from the transcript alone. C02 is also serious
(silent data loss) but is scoped to a single Sheets/schedule flow; C06 generalizes
to every platform/account combination the assistant will ever be asked about, so
fixing the *pattern* (detect mismatch → offer a real choice) pays off across many
future requests, not just Pinterest. It was also the cheapest fix to make safely:
account/platform resolution already existed (`inferAutomationAccountPlatform`,
`automation-ad-account-options.ts`) and the `ask_user` picker infrastructure
already existed (`app/chat/components/cards/QuestionCard.tsx`) — the fix is
composition, not new subsystems, which keeps risk low on a shared codebase.

**C02 second (not done, but next).** Fixing it needs either capturing explicit
weekday/time/timezone fields on the trigger step (schema work in
`polling-schedule-field.tsx` / `schedule-field-scope.ts`) or asking a clarifying
question when the source format can't be parsed exactly — more surface area than
C06, so it did not fit in this pass's scope.

**C01 third.** It is real friction, but it is UX polish on top of an
already-correct flow (the canvas ends up right); C02's data loss and C06's
wrong-platform action are both worse failure modes than "the assistant repeated
itself." Fixing it properly needs the mock (and eventually the real assistant) to
recognize "this message is a confirmation, not a new request" — which the new
`attempt_started`/`attempt_outcome` telemetry (specifically `hadExistingDraft` and
`existingNodeCount` on `attempt_started`) now gives a concrete signal for, even
though this pass didn't wire that signal into a fix.

## What remains uncertain

- Whether real customers who hit C01 ever actually clicked Save — this demo cannot
  answer that; only wiring telemetry into the *live* product (see `EVENT_SINK_NOTE`
  in `lib/telemetry/events.ts`) could.
- Whether C02's customer would have accepted a fixed-offset "EEST" interpretation
  or wanted a location timezone (Europe/Athens) — the raw customer report is
  ambiguous on this and would need a clarifying question either way.
- Whether the C06 fix's picker-based flow generalizes to platforms with many more
  connected accounts than this demo's three-account fixture directory
  (`DEMO_ACCOUNT_DIRECTORY` in `lib/mock/assistant-script.ts`) — untested at scale.
