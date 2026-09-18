# Improvement shipped: C06 platform/account mismatch

## Before

`lib/mock/assistant-script.ts` had no platform awareness. A request like "switch
off specific pinterest ads" with a Meta account selected matched the generic
`wantsPause()` regex and silently built a **Meta** pause automation — service
`"meta-ads"` on the customer's Meta account — with the closing text describing it
as done, never mentioning Pinterest at all. The customer had no way to discover
the mismatch from the transcript.

Reproduced in `evals/fixtures.ts` as `regression`-style evidence via
`lib/telemetry/fixtures.ts`'s `fixture-attempt-5` (visible on the dashboard's
before/after card at `/automation/insights`): one turn, `attempt_outcome: drafted`,
no question asked, wrong platform.

## After

`buildMockTurn` now:

1. Resolves the platform of the **currently selected** account
   (`resolveCurrentPlatform`, using the same kind of account/platform inference the
   real app already does via `inferAutomationAccountPlatform`).
2. Resolves the platform **named in the request text** (`resolveRequestedPlatform`).
3. When they disagree, returns `platformMismatchTurn(...)`, which asks a real
   question through the app's existing `ask_user` "choice" card
   (`app/chat/components/cards/QuestionCard.tsx`) — the same inline-picker UI the
   product already renders for any other clarifying question — listing every
   connected account for the requested platform, **and builds nothing** until the
   customer picks one.
4. When the customer answers with one of the listed account names
   (`pickedDirectoryAccount`), the next turn builds on *that* account/platform
   instead — `service: "pinterest-ads"` on the Pinterest account, not Meta.
5. When no account for the requested platform is connected at all, it says so
   plainly instead of building anything ("Pinterest isn't connected to this
   workspace yet...") — an honest capability boundary instead of a silent
   substitution.

This is composition, not a new subsystem: the account/platform resolution and the
`ask_user` picker rendering both already existed in the codebase; the fix wires
them together at the one place (`buildMockTurn`) that was missing the check.

`docs/investigation.md` has the full repro and the "why C06 first" reasoning.

## Eval evidence

`evals/fixtures.ts` → `c06-unsupported-platform` (run via `pnpm run eval`, see
README):

| Turn | Expectation | Result |
| --- | --- | --- |
| 0 — "switch off specific pinterest ads" (Meta selected) | asks via `ask_user`, builds **zero** automation tool calls, closing mentions both "Pinterest" and "Meta" | **pass** |
| 1 — "Northwind Coffee — Pinterest" (answers the picker) | no further question, builds with `service: "pinterest-ads"` | **pass** |

The control case (`control-pause-underperformers`) and the held-out regression case
(`regression-scale-winners`) both still pass — the fix does not change behavior for
requests that already match the selected account's platform.

## Sample size and honesty about the claim

This is a **demo-scale** improvement: one eval case, one fixture attempt pair on
the dashboard. It demonstrates the mechanism (detect → ask → build correctly) works
for the scripted responder. It is **not** evidence of a production retention lift —
see the README's "Production experiment" section for what that would take.
