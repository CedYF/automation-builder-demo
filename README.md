# Automation agent challenge

Improve the mock **Auto-hide negative comments** flow. No real pages or comments are changed.

## Customer problem

Advertisers connect a Facebook Page and hide negative comments on their ads to protect performance. They need to trust the page choice and the comments selected. This demo cannot prove performance lift.

## Live coding task

In the live coding session, you will be asked to change this demo so customers can set up and trust the automation without your explanation. Use mock data to answer three questions:

1. **What does “negative” mean?** Explain the rule and show hidden and visible examples with reasons, including brand attacks that sound neutral.
2. **How can I check activity?** Show which comments were checked or hidden, on which Page, why, and whether the automation is on.
3. **How often will this run?** Explain that, when on, it checks each new comment as it arrives. Show current status and the last check's result.

Start at **Automate → Chat → Hide negative comments on my ads**. The Agent should find connected pages, confirm which to watch **before** editing the draft, then guide customers through preview, save, and turn-on.

Improve **Admin analytics**: show setup drop-off, Agent failures, successful runs, and the biggest issue to fix. Deduplicate retries.

**Main KPI — first successful automation rate:** Percentage of starters who save, turn on, and get a successful simulated hiding run within 7 days. Show numerator, denominator, and time window; include only starts at least 7 days old.

Label mock results as simulated.

## Current screens

**Chat start**

![Chat landing with the one suggested automation](docs/screenshots/00-chat-start.png)

**Agent page choice**

![Agent asking which mock page to watch](docs/screenshots/01-agent-page-confirmation.png)

**Comment preview**

![Preview scoped to the chosen mock page](docs/screenshots/02-comment-preview.png)

**Admin analytics placeholder**

![Automation health dashboard placeholder](docs/screenshots/03-admin-health-dashboard.png)

## Run

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000/automation` (or the port Next.js prints). No account or keys needed. To check your changes in another terminal: `pnpm typecheck && pnpm test && pnpm build`. We will review the running UI; no write-up needed.
