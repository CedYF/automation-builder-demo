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
```

Open http://localhost:3000. No database, production accounts or API keys are required.

## UI baseline

The automation home, chat entry, builder dock and assistant have been refreshed from the product's 14 September 2026 source snapshot. Start here; the exercise is to improve the customer journey and make its quality measurable.

See [docs/ui-sync.md](docs/ui-sync.md) for scope and demo adaptations.

## What is real and what is mocked

- **Interactive UI:** automation home, chat entry, canvas, step editing, assistant streaming, template gallery and workflow state.
- **Mock accounts:** one fixed demo user and workspace. No production authentication.
- **Mock storage:** three seeded automations. Save, rename, duplicate, toggle and delete use an in-memory store. Server reloads reset state.
- **Scripted assistant:** real SSE transport with scripted pause/scale responses. It is not a production model. Unsupported prompts do not establish model-quality results.
- **Execution and integrations:** simulated or unavailable. No live ads, comments, Slack messages or provider resources are changed. Many integration-specific configuration panels remain labelled stubs.
- **Other API responses:** empty demo responses allow secondary views to render. They do not prove integration success.
- **Logging, quality dashboard and eval workflow:** these are the new challenge deliverables, not claims about features already implemented here.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/automation/` | Home, chat, builder, hooks and flow state |
| `app/api/` | Mock API endpoints |
| `lib/mock/` | Demo user adapters, scripted assistant and automation store |
| `components/ui/` | Shared UI controls |
| `docs/customer-cases.md` | Sanitized problems and suggested eval checks |
| `TASK.md` | Deliverables and review criteria |

Service logos are third-party trademarks used to identify integrations. All demo metrics and outcomes must be labelled as simulated when used in your submission.
