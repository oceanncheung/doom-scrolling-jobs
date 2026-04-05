# Canonical IA and Terminology Map

## Naming Principles

- One user-facing noun per concept.
- Internal implementation terms must not leak into product copy.
- Queue labels are user-facing views, not raw database state names.
- `Prepare` is a verb. `Application packet` is the noun.

## Canonical Noun Map

| Current terms in use | Problem | Canonical user-facing term | Internal-only term |
| --- | --- | --- | --- |
| `operator`, `account`, `workspace` | Three nouns currently describe the active browser-session identity. | `Account` | `operator` |
| `workspace settings`, `profile` | The page title and shell label imply two different concepts. | `Profile` | `workspace` can remain a shell concept only |
| `resume source`, `cover letter source`, `source files`, `source documents` | Intake nouns drift. | `Source documents` | `rawSourceText`, `sourceContent` |
| `canonical`, `approved`, `reviewed`, `profile draft` | Internal approval language leaks into user-facing logic. | `Profile draft` and `Profile ready` | `canonical approval` |
| `job detail`, `job review` | The current detail page is really an evaluation step. | `Job review` | `job detail` can remain route-level only |
| `application prep`, `packet`, `packet review` | The noun is inconsistent. | `Application packet` | `packet` |
| `saved`, `shortlisted` | User action and stored state use different language. | `Saved` | `shortlisted` |
| `prepared`, `ready to apply` | The view label and stored state do not match. | `Ready` | `ready_to_apply` |
| `archive`, `archived`, `dismissed`, `rejected` | Similar but not identical outcomes are visually compressed. | `Archived` for the queue view | `archived`, `rejected` remain internal statuses |

## Canonical Verb Map

| User action | Use this verb | Do not use |
| --- | --- | --- |
| Pick active session identity | `Choose account` | `Choose operator` |
| Add a new internal identity | `Create account` | `Create operator` |
| Upload intake materials | `Upload source documents` | `Upload canonical source` |
| Turn uploads into structured profile | `Generate profile` | `Generate canonical assets` |
| Confirm extracted data and preferences | `Save profile` | `Approve canonical profile` |
| Keep a job in consideration | `Save job` | `Shortlist` in user-facing copy |
| Remove a job from active attention | `Dismiss` or `Archive` | `Reject` unless the employer rejected the user |
| Start application materials | `Prepare packet` | `Generate packet` as the primary CTA |
| Mark materials done | `Mark ready` | `Prepared` |
| Record external submission | `Mark applied` | `Submit` |

## Terms to Keep Internal

These terms are valid in code and docs, but should not appear in user-facing copy:

- `operator`
- `canonical`
- `sourceContent`
- `generatedFrom`
- `approvalStatus`
- `packetGenerationStatus`
- `database-fallback`
- `seed`

## Route-Level IA Rules

### Dashboard

- Use queue labels that imply action:
  - `Potential`
  - `Saved`
  - `Ready`
  - `Applied`
  - `Archived`
- `Preparing` should not be a top-level queue label. It is a packet-progress state.

### Profile

- Use `Source documents` for intake.
- Use `Profile` for the page.
- Use `Matching preferences` for anything that affects ranking but is not a source fact.

### Job flow

- `/jobs/[jobId]` should read as `Job review`.
- `/jobs/[jobId]/packet` should read as `Application packet`.

## Terminology Findings

| Priority | Finding | Recommendation | Impact | Effort | Owner |
| --- | --- | --- | --- | --- | --- |
| `P1` | `Account`, `operator`, and `workspace` are all user-visible or user-adjacent labels today. | Standardize on `Account` for user-facing account selection; reserve `Profile` for user data and `workspace` for internal shell language only. | `user clarity` | `small` | `product` |
| `P1` | Dashboard queue language does not map directly to persisted statuses. | Rename the queue view currently called `Prepared` to `Ready`; keep `shortlisted` and `ready_to_apply` internal unless they are intentionally surfaced. | `user clarity` | `small` | `product` |
| `P1` | `Packet` and `application prep` describe the same surface. | Use `Application packet` as the canonical noun and `Prepare` as the canonical verb. | `system consistency` | `small` | `product` |
| `P1` | Approval and review language leaks implementation details. | Hide `canonical` and other backend-state language from the interface; replace with `Profile draft`, `Save profile`, and `Profile ready`. | `user clarity` | `small` | `product` |
| `P2` | `Archive`, `Dismiss`, and `Reject` are not visually separated as concepts. | Keep `Dismiss` as an action, `Archived` as the queue view, and `Rejected` as an employer-outcome state. | `system consistency` | `small` | `product` |
