# Challenge: make the automation agent measurably better

Customers describe an automation, work through questions, and expect a working result they can understand and trust. A completed chat stream does not tell us whether they got there.

Your job is to **add useful logging and a quality dashboard, investigate customer problems, turn them into evals, and improve the experience**. The aim is to help more customers reach their first successful automation and keep getting value from it.

Start from the UI in this repository. The home, chat entry, assistant and builder have been refreshed from the product. This is a product engineering and agent quality challenge, not a request to recreate a competitor's interface.

## 1. Understand the customer problems

Read [the customer cases](docs/customer-cases.md). They are anonymized, paraphrased examples from our automation-agent feedback channel. They include observed interaction problems, not proof that a provider execution failed.

Choose at least three cases. Reproduce the current behavior, identify where the journey breaks, and explain which problem you would fix first and why. Look beyond model answers: missing UI feedback, confusing controls, lost context, unsupported capabilities and unclear next steps all count.

Distinguish what the transcript proves, what the flow state proves, and what would require execution evidence. Do not assume “zero tool errors” means the customer succeeded.

## 2. Add logging that explains the journey

Instrument the real demo interaction path. A dashboard backed only by hardcoded totals is not enough. Make it possible to follow one attempt from prompt to outcome and connect related retries without double-counting them.

Capture enough to answer:

- What was the customer trying to do, on which platform and with which existing draft?
- What question did we ask, why, and did they answer it?
- Which tools ran, how long did they take, and what changed in the draft?
- Was the result complete, blocked, unsupported, cancelled, or still waiting?
- Did the customer preview, save, activate and reach a successful run? These are separate events.
- Did they retry, restart, abandon the attempt, or come back later?

Define a typed event contract with event ID, time, session/attempt/turn correlation, flow revision, model/prompt version where applicable, timing, outcome and a useful error category. Handle streaming interruption and duplicate delivery. Do not log secrets or unrestricted customer payloads. Redact before persistence or export, not just in the UI.

Use local persistence and a resettable fixture importer so reviewers need no accounts or keys. Document storage, retention and the point where a production event sink would attach. The product uses structured Axiom logs; this demo must not send events to production.

## 3. Build a dashboard that helps someone decide what to fix

A product engineer should be able to:

1. See where attempts drop out of the prompt → draft → preview → save → activate → successful-run journey.
2. Filter by problem category, platform, version, time range and outcome.
3. Open an attempt to see its timeline, questions, tool results, draft changes and customer-visible outcome.
4. Identify repeated failures or friction, record a review label, and turn a reviewed case into an eval.
5. Compare the baseline with your improvement, including regressions and sample size.

Include loading, empty, no-results and error states. Use plain labels and readable summaries, with technical detail available on demand. Distinguish observed, simulated and unknown outcomes everywhere. A seeded successful run is not proof that a live ad was changed.

## 4. Set up evals from the problems

Create a versioned, runnable dataset and evaluator. Each case should contain:

- An anonymous case ID and problem category.
- Initial conversation, selected account/platform, existing flow and available capabilities.
- Input turns, including answers to clarification questions where relevant.
- Expected behavior and explicit failure conditions.
- Checks against the resulting flow, tool sequence and user-visible response.

Use deterministic assertions for things such as preserved nodes, schedule/timezone, resolved identifiers, required steps and truthful state labels. If you add a model judge for clarity or helpfulness, document the rubric, judge version, uncertainty and human calibration. A model judge is optional; the default suite must run without API keys.

Include multi-turn cases, ambiguity, interruption/retry and an unsupported request. Keep a small held-out regression set. Record baseline and changed results against the same inputs and versions. Report passes, failures and regressions per category; do not hide a serious regression behind an average score.

Provide one command to run the suite, a machine-readable result, and a human-readable comparison. Include an example of converting a reviewed dashboard attempt into a sanitized eval fixture. The existing unit tests are useful, but they are not a substitute for evaluating the end-to-end interaction.

## 5. Make and demonstrate an improvement

Ship at least one focused improvement to the agent or UI, driven by your findings. For example:

- Resolve an account or template by name using an inline picker rather than demanding a raw ID.
- Keep the current draft intact when a customer asks a follow-up question.
- Make template selection and text variations visible and verifiable.
- Show exactly what is drafted, saved, active or blocked, with the next action beside it.
- Ask for a missing timezone without losing the customer's requested days and time.

Show the before/after journey and eval results. Preserve save, rename, preview, run and activation behavior within the mock's documented limits. Keep one source of truth for the flow in `automation-context.tsx`.

## How this connects to retention

Define the mechanism you expect to improve: fewer abandoned clarification loops, faster time to a valid draft, more saved automations reaching a first successful run, or fewer repeated failures.

Describe how you would measure activation and repeat successful usage at 7 and 28 days using eligible cohorts, explicit denominators and an observation window. A customer who has not had time to return is not churned. Offline eval scores and demo data cannot establish a retention lift; explain the production experiment needed to test your hypothesis, with failure and latency guardrails.

## Deliverables

- Working logging, dashboard, eval suite and one demonstrated improvement.
- Sanitized fixtures covering at least three customer problems and a held-out regression set.
- A short investigation: evidence, diagnosis, prioritization and what remains uncertain.
- Baseline and changed results with reproducible commands.
- A short walkthrough showing an attempt → diagnosis → eval → improvement → comparison.
- A concise README explaining what works, what is mocked and what you deliberately left out.

Do a coherent slice well. You do not need to solve every customer case or build a general-purpose observability platform.

## Review criteria

| Area | What we look for |
| --- | --- |
| Customer understanding | Correctly identifies the real friction without inventing execution outcomes. |
| Logging | Correlated, useful events from actual interactions; safe, inspectable persistence. |
| Dashboard UX | Makes failures understandable and the next investigation obvious. |
| Eval quality | Reproducible cases, meaningful assertions, multi-turn coverage and visible regressions. |
| Improvement | Demonstrably better behavior, not just a rewritten prompt or a prettier chart. |
| Product judgment | A credible connection to activation and repeat value, with honest measurement limits. |
| Engineering | Typed, maintainable code, useful tests, no production dependencies required. |

## Starting points

| Area | Path |
| --- | --- |
| Page and tabs | `app/(dashboard)/automation/page.tsx` |
| Automation home | `app/(dashboard)/automation/components/automation-home.tsx` |
| Chat entry | `app/(dashboard)/automation/components/automation-chat-landing.tsx` |
| Assistant UI | `app/(dashboard)/automation/components/assistant-panel.tsx` |
| Streaming client | `app/(dashboard)/automation/hooks/use-automation-assistant.ts` |
| Flow state | `app/(dashboard)/automation/contexts/automation-context.tsx` |
| Step ordering | `app/(dashboard)/automation/lib/assistant-step-order.ts` |
| Scripted responder | `lib/mock/assistant-script.ts` |
| Assistant endpoint | `app/api/automation-assistant/stream/route.ts` |
| Mock persistence | `lib/mock/automation-store.ts` |

The mock responder is deliberately limited. Extend it to exercise your cases, or add an optional real model adapter behind an environment variable while keeping a no-key default. Label scripted and live-model results separately.
