# Automation agent challenge

This is a mock AdManage demo. Work on **one journey only: Auto-hide negative comments**. No real pages, comments, or provider actions are involved.

## The customer problem

Customers ask the agent to set up comment hiding, but they struggle to tell which pages it will watch, which comments it will hide, whether the automation is only a draft or actually on, and what to do next. Some ask the agent to explain the flow immediately after it builds one. The experience needs to earn their trust before they turn it on. See [customer cases](docs/customer-cases.md) for context.

## What to build

### 1. Improve the Agent UI and setup workflow

Start at **Automate → Create**. It opens the only template in the normal builder with the Agent beside it. Make this journey simple and obvious:

1. The Agent finds the connected **mock** Facebook and Instagram pages, then asks the customer to confirm which to watch.
2. It sets up the negative-comment rule and the hide action on the canvas. The customer can see and change what the rule will match.
3. A preview uses **mock comments** to show what would be hidden and what would stay visible, with a reason for each decision.
4. The UI states clearly whether the automation is a draft, saved, or on, and gives one useful next action. Saving and turning it on are separate steps.

Improve the conversation and the UI together. Keep the scope to this flow; do not add more templates, a general chat area, or real integrations.

### 2. Improve the admin health dashboard

Open **Admin analytics** from the sidebar. Turn the placeholder into a dashboard that helps the team decide what to fix next as usage grows. Show the setup funnel, where people leave, Agent errors or repeated questions, and whether completed automations actually run successfully. Make the biggest problem and its affected customer count easy to spot. Counts should use people or setup journeys, not raw events; retries must not inflate them.

**Main KPI: first successful automation rate.** Of the unique people who start this template, what percentage save it, turn it on, and reach a first successful comment-hiding run within 7 days? Show the numerator, denominator, and time window; only include starts old enough to have a full 7 days. A saved draft or an enabled rule with no successful run does not count. In this demo, label runs and results as simulated.

Use setup completion, step drop-off, time to first success, failed runs, and repeat successful runs as supporting measures. The sample events in [`fixtures/axiom-events.ndjson`](fixtures/axiom-events.ndjson) are a starting point; add or adapt mock events if needed to measure this one journey honestly.

## Run and check

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Open `http://localhost:3000/automation` (Next.js may choose another port if 3000 is busy). The app needs no accounts or API keys. We will review the running UI and dashboard; no write-up is needed.
