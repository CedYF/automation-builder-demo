/**
 * A comment automation's run history: the view at
 * `/automation?automationId=comment:<id>&view=history`, the run log it renders,
 * and the helpers only this feature uses.
 *
 * Deliberately narrow. Everything else in /automation reaches into
 * `components/`, `lib/` or `hooks/` by path instead, because widening this
 * barrel would close an import cycle: `lib/comment-run-live-feed` reads the
 * builder's automation context, which would then import this file.
 */

export { CommentAutomationHistoryView } from "./components/comment-automation-history-view";
