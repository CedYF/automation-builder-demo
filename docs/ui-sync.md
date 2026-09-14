# UI refresh — 14 September 2026

Source: AdManage automation area on the existing `main` checkout, latest area commit `d5ba788389e21e188d3c0b552e73beb9a007e409`.

## Refreshed surfaces

- Automation home: state filters, search, row controls, pagination and estimated-effort tiles.
- Chat tab: account selection, categorized prompts and template entry.
- Builder: context header, step readiness, revised node cards and a resizable Step/Agent dock.
- Assistant: live activity, draft summary, setup guidance and the current streaming client.
- Supporting flow normalization, validation, templates, account icons and comment-history UI contracts.

## Standalone adaptations

The existing demo accounts, in-memory rules and scripted SSE responder remain. Production server actions, authentication, credentials, billing and live provider execution are not included. Integration configuration stubs remain where the original extraction used them; this is not a complete production clone.

`/api/automation/home` derives rows from the same in-memory rules used by save and toggle. It reports zero execution metrics rather than fabricating successful runs. The page carries a visible demo notice. Comment API calls stay on a local mock route and credential operations explicitly reject real credentials.

The rules endpoint accepts partial name/status updates without discarding the saved flow. Seeded chat sends are deferred until mount effects settle so React development Strict Mode does not cancel the first request. Scripted step identifiers match the refreshed validator's producer references.

The old competitor screenshots and reference brief have been removed. The new TASK.md defines the logging, dashboard, eval and improvement work for candidates; the UI refresh does not implement those deliverables for them.

## Verification

Run `pnpm typecheck`, `pnpm test` and `pnpm build`. The tests cover the refreshed chat labels, step ordering, canvas zoom and the home/storage create → rename → toggle → delete contract. Browser checks cover the home, chat entry, streamed draft and save path. These checks validate the standalone demo, not production execution or retention.
