# Customer problems to investigate

These are anonymized paraphrases of interactions reviewed on 14 September 2026 in the internal automation-agent feedback channel. Customer identities, account IDs, folder URLs, template IDs and private transcript exports are intentionally excluded. Candidates need no Slack access.

These observations concern the conversation and visible workflow. We did not independently verify provider execution or measure retention. Earlier internal reviews are useful hypotheses, not a current production failure count.

| Case | Observed interaction | What to investigate | Example eval checks |
| --- | --- | --- | --- |
| C01 — repeated confirmation | A customer asked to pause rejected TikTok ads with an account already selected. The agent asked for confirmation, described a completed draft, then repeated the same save/activate instructions multiple times after the customer said “build.” | Unnecessary turns, repeated final answers, and uncertainty about whether anything was saved. | Use available account context; ask only necessary questions; one final summary; distinguish draft from saved and active; no duplicate action on retry. |
| C02 — schedule fidelity | A customer wanted a Sheets automation on Monday, Tuesday and Wednesday at 9am EEST. The agent initially substituted a polling trigger, then asked for a source ad-set ID. The transcript alone does not show the final schedule configuration. | Whether the actual schedule matches the request and whether the customer can verify it. | Assert all requested weekdays, 09:00 and timezone semantics in the flow; clarify fixed offset versus a location timezone if needed; preserve the schedule while resolving the source ad set. |
| C03 — invisible template | A customer wanted Drive media launched with all five text variations from an ad-copy template. The agent collected multiple raw IDs, said everything was configured, then gave conflicting explanations when the customer could not find the template in the UI. | Whether the correct template type is supported, how it is selected, and whether the UI and actual config agree. | Resolve a fixture template by name; verify all five variations where supported; display the selected template; never claim a nonexistent field is visible; explain unsupported template types accurately. |
| C04 — preserve the draft | An earlier internal review reported that a retry during a clarification reset a customer's draft. A subsequent fix was proposed, so this is a regression case to recheck, not a claim it remains broken. | Follow-up questions, stream retries and restart behavior. | A question does not clear existing nodes; a replay does not duplicate steps; a deliberate restart is distinguishable from a normal follow-up. |
| C05 — complete the requested flow | An earlier review described requests where a follow-up action was omitted or interpreted as a different operation: moving processed files to an Approved folder became watching that folder, or a pause-and-rename request lost the rename. | Whether the final flow satisfies every requested action rather than merely looking plausible. | Match requested operations and ordering; preserve the original trigger; report an unsupported operation explicitly instead of substituting another one. |
| C06 — unsupported platform | Several requests asked to switch off specific Pinterest ads while a Meta account was selected. A prompt alone does not show whether the agent handled the mismatch correctly. | Account/platform mismatch and honest capability boundaries. | Detect the mismatch; offer a supported account/capability choice; do not build a Meta action and describe it as Pinterest. |

## Channel-level evidence

Reviewing the same feedback channel again showed three patterns worth checking against the cases above. They are counts of conversations we read, not measured failure rates.

- **Use cases:** comment moderation dominates (hide or delete negative comments, reply to FAQ comments, hide comments naming a competitor). Scheduled pause and activate rules come second, for example pausing ads under a spend floor over seven days, or running Friday night and stopping just after midnight.
- **"Explain what this automation does":** four or more customers asked this after the agent finished building. The builder does not say what was built, its state, or the next action. This underlies C01 and C03.
- **Duplicate delivery:** the same customer message was processed two to four times, tracked internally as a known issue. The client retries a stream without a per-turn identifier, so a replay can produce a second summary. It relates to C01 and C04.
- **Platform mismatch (C06):** one customer sent the same Pinterest request against a Meta account three times.

The starter reproduces the mismatch, the duplicate summary, the clarification loop and the lost timezone with scripted prompts, listed in the README.

## Suggested fixture structure

Use fictional resources such as “Demo Store”, “Creative Test Campaign”, “Approved Assets” and “Five-copy template”. Represent IDs with local fixture keys, never copied production IDs.

For each case, include the initial flow, account context, capability inventory, conversation turns, expected state, forbidden behavior and evidence limits. Include at least one successful control so a policy of refusing everything cannot pass your suite.

Review both correctness and experience: a structurally valid flow can still be hard to understand, and a fluent answer can still describe a flow that was never saved.
