# PRD: Phase 1 Designer Job Operating System

_Version: 1.0_
_Date: April 1, 2026_

## 1. Product Summary

Build a web product that helps designers discover remote jobs, rank them intelligently, and prepare all materials needed for manual application submission.

Phase 1 is a **decision-support and application-prep system**, not an auto-submit bot. The product should help the user focus on better-fit, higher-quality, better-paying roles and reduce the manual effort required to prepare a strong application.

## 2. Target Users

### Primary users

- graphic designers
- brand designers
- visual designers
- marketing designers
- presentation designers

### Supported adjacent roles

- product designers
- motion designers
- art directors
- creative leads / creative directors
- content or campaign designers
- UI designers when portfolio and experience fit are credible

### User assumptions

- The user has one core professional identity.
- The user wants remote work only.
- The user values job quality and compensation more than application volume.
- The user is willing to review, edit, and manually submit applications.
- Portfolio selection matters as much as resume positioning.

## 3. Product Goals

- Help the user discover remote design roles from a curated set of sources.
- Normalize and rank opportunities so high-quality jobs surface first.
- Preserve one stable user profile while adapting outputs per job.
- Generate practical application materials that are ready to review and paste.
- Reduce low-value application effort without sacrificing quality or truthfulness.
- Track the user’s pipeline from discovery through application and follow-up.

## 4. Non-Goals

- Automatic ATS form submission in Phase 1
- High-volume auto-apply behavior
- Creating multiple personas or alternate user identities
- Fabricating resume or portfolio experience
- Full CRM for recruiters, referrals, and networking
- Interview preparation tooling
- Email sync or inbox orchestration

## 5. MVP Scope

### Included in Phase 1

- One user profile per user
- Remote-only job filtering
- Job ingestion from a small number of selected sources
- Job normalization and duplicate handling
- Weighted scoring with remote gating, quality priority, and salary emphasis
- Support for designer-first and adjacent design roles
- Shortlist / dismiss / save workflow
- Application packet generation per job
- Resume tailoring recommendations and saved resume versions
- Portfolio link and case-study recommendation
- Cover letter draft generation
- Short-answer and field-by-field application response generation
- Manual application status tracking

### Explicitly excluded from Phase 1

- Auto-fill or auto-submit to ATS systems
- Broad browser automation across job boards
- Outreach automation
- AI-generated fake experience
- Fully automated resume PDF design engine beyond a practical export flow

## 6. Core Product Principles

### Quality over volume

The product should steer the user toward strong-fit, high-quality jobs instead of maximizing raw applications.

### Human-in-the-loop

The system recommends, prepares, and organizes. The user reviews and submits.

### One profile, many outputs

The user maintains one canonical profile that can generate many tailored outputs without fragmenting identity.

### Portfolio is first-class

For design roles, the portfolio is part of the application strategy and should be treated as a structured asset, not just a single URL.

### Structured outputs beat generic AI prose

Every AI output should be reviewable, traceable, and usable in the application workflow.

## 7. User Flows

### 7.1 Onboarding and profile setup

1. Internal operator opens the app without a login gate.
2. Internal operator edits one canonical profile with role targets, salary preferences, skills, work history, links, and portfolio items.
3. Internal operator sets adjacent roles they are willing to consider.
4. Internal operator confirms remote-only preference and compensation expectations.

Success criteria:

- The system has enough structured data to evaluate fit and generate application materials.

### 7.2 Job intake and ranking

1. System imports jobs from selected sources.
2. System normalizes title, company, location, remote status, compensation, and job text.
3. System deduplicates repeated listings.
4. System filters out non-remote roles.
5. System scores eligible jobs against the user profile.
6. User reviews ranked jobs in the dashboard.

Success criteria:

- The top of the list is meaningfully better than a chronological feed.

### 7.3 Shortlist and decision flow

1. User opens a ranked job.
2. System shows score breakdown, key reasons, salary interpretation, and red flags.
3. User saves, dismisses, or shortlists the job.
4. User can add notes or reasons for skipping.

Success criteria:

- The user can quickly decide whether a role deserves application effort.

### 7.4 Application packet generation

1. User selects a shortlisted job.
2. System generates an application packet from the master profile and job record.
3. Packet includes tailored resume content, recommended portfolio link or case studies, cover letter draft, short answers, and field-ready text.
4. User reviews and edits generated content.
5. System stores the final packet as a reusable artifact.

Success criteria:

- The user can move from shortlist to submission-ready materials with minimal manual rewriting.

### 7.5 Manual application tracking

1. User submits the application outside the product.
2. User updates status inside the dashboard.
3. System logs timeline events and follow-up reminders.

Success criteria:

- The product remains the source of truth for where each job stands.

## 8. Main Features

### 8.1 Canonical profile management

Store one stable user profile with:

- personal and work authorization details
- target roles and allowed adjacent roles
- skills, tools, industries, and experience
- compensation preferences
- portfolio library and primary links
- master resume content

### 8.2 Job ingestion and normalization

Support an initial small set of curated sources and normalize:

- company
- title
- location and remote classification
- compensation data
- job description text
- required and preferred qualifications
- application URL

### 8.3 Job scoring and explanation

Score jobs only after remote eligibility is confirmed. Ranking should emphasize:

- company and role quality
- compensation attractiveness
- role relevance
- seniority fit
- portfolio alignment
- application effort and trust signals

The user should see:

- total score
- component scores
- why the role ranks where it does
- missing requirements
- red flags

### 8.4 Application prep hub

The application prep hub is the workspace where the system assembles all materials needed for a manual application.

For each job it should produce:

- tailored resume recommendations
- saved resume version content
- practical resume PDF export path
- portfolio link recommendation
- recommended case studies and ordering
- cover letter draft
- short professional summary
- short-answer drafts
- field-by-field application text
- copy-ready blocks and notes

### 8.5 Tracking workflow

Statuses for Phase 1:

- New
- Ranked
- Shortlisted
- Preparing
- Ready To Apply
- Applied
- Follow-Up Due
- Interview
- Rejected
- Archived

## 9. Functional Requirements

### Profile

- The system must support exactly one active core profile per user.
- The system must allow updates to preferences, history, skills, and portfolio items without creating separate personas.
- The system must track target roles and allowed adjacent roles explicitly.

### Jobs

- The system must store a normalized job record for each unique listing.
- The system must store source metadata and original URLs.
- The system must support deduplication across multiple intake sources.
- The system must classify remote status conservatively.

### Scoring

- Non-remote roles must not receive an apply recommendation.
- Quality and salary must have stronger impact than secondary factors.
- Adjacent roles may score well if fit is high.
- The score must surface red flags and low-quality signals clearly.

### Application packet

- A packet must be tied to one user and one job.
- A packet must persist generated artifacts and editable text outputs.
- Resume variations must remain traceable to the master resume and target job.
- Application answers must be structured enough to map to individual form fields.

### Tracking

- The system must record status changes and notable events over time.
- The user must be able to see what was applied to, when, and with which packet.

## 10. Constraints And Risks

### Technical constraints

- Job data will be incomplete, inconsistent, and duplicated across sources.
- Remote wording is ambiguous and needs conservative normalization.
- Compensation is often missing or expressed in inconsistent formats.
- Resume export may require a staged approach before a polished PDF pipeline exists.

### Product constraints

- The product must stay useful without full automation.
- Recommendations must remain truthful and reviewable.
- A designer’s portfolio strategy cannot be reduced to one generic link.

### Risk areas

- Scoring quality may drift if prompts or inputs are weak.
- AI-written application content may become too generic without strong structured prompts.
- False positive remote classification can waste user time.
- Over-weighting salary could bury strong-fit jobs with undisclosed compensation.
- Over-broad adjacent-role matching could surface roles that look plausible but are not credible fits.

## 11. Success Metrics For Phase 1

- The user can identify worthwhile jobs faster than with manual browsing alone.
- A shortlist contains materially better-fit roles than an unranked feed.
- Packet generation reduces time-to-apply for shortlisted jobs.
- The user can explain why a job was recommended and why another was deprioritized.
- The system maintains a reliable application history.

## 12. Phased Roadmap

### Phase 1: Discovery, ranking, and application prep

- one canonical profile
- job ingestion from curated sources
- normalization and deduplication
- remote gating
- quality and salary scoring
- portfolio-aware application packet generation
- manual status tracking

### Phase 2: Workflow acceleration

- improved resume PDF export flow
- richer source coverage
- better follow-up reminders
- more robust evaluation of prompt quality
- optional outreach drafts

### Phase 3: Controlled automation and optimization

- browser-assisted application support with Playwright
- analytics-driven ranking refinement
- more advanced packet generation and version comparison
- optional integrations for tracking and performance analysis

## 13. Immediate Build Priorities

1. Lock the schema for users, jobs, scoring, and application packets.
2. Turn the scoring framework into a clear contract with explanations and penalties.
3. Scaffold the web app and authentication foundation.
4. Build the jobs dashboard and detail view around normalized records.
5. Add application packet generation after the data model is stable.
