# ETHAN CBT v0.2.1 — Live-connected application build

**Product:** ETHAN CBT  
**Issuer / institution:** Ethan Digital Academy  
**Parent company:** ALLON-MAADIAH INTERNATIONAL LIMITED (RC 1364788)  
**Tagline:** PREPARE. ASSESS. EXCEL.  
**Planned application URL:** `https://cbt.ethandigitalacademy.org`

ETHAN CBT is a computer-based testing and examination management application. This build replaces the earlier demonstration-only prototype with a Supabase-connected application.

## Connected backend

- Supabase project: `ethan-cbt`
- Project reference: `juumaqmkcmfpexgpzpfy`
- Region: Europe West (Ireland)
- Database: PostgreSQL 17
- Project URL: `https://juumaqmkcmfpexgpzpfy.supabase.co`
- Client key: Supabase publishable key in `config.js`

The browser configuration contains only a publishable key. **Never add a Supabase secret or service-role key to `config.js`, GitHub, or any client-side file.**

The project was provisioned separately from ETHAN CERTIFICATE. It has 17 public tables, all with Row Level Security enabled. No anonymous table grants were found. Public RPC execution is denied; application RPCs are available to authenticated users and enforce their own user, institution, candidate-session or staff-role checks.

## Current connected features

### Identity and access
- Email/password sign-in and sign-out.
- Candidate account registration (subject to the Supabase Auth email-confirmation and signup settings).
- Password reset email flow and password-update screen.
- Institution membership and role resolution.
- Owner, administrator, question setter, invigilator, examiner and candidate roles.
- Owner/admin assignment of an existing CBT account to an institution role.
- Sign-out in the dashboard top bar and sidebar.

### Administrator / staff workspace
- Live dashboard counts.
- Subject creation and listing.
- Question-bank creation and listing.
- Atomic question creation with marking key stored separately from candidate content.
- Single-choice, multiple-choice, true/false, short-answer, fill-in-the-blank and essay questions.
- Examination creation, question selection, scheduling, publishing and candidate assignment.
- Candidate and staff membership management.
- Active-session and integrity-event monitoring.
- Results review, manual essay/short-answer marking, CSV result export and controlled result release.

### Candidate workspace
- Assigned examination list.
- Server-controlled exam start/resume and deadline.
- Candidate-safe question delivery.
- Saved-answer recovery on resume.
- Per-question save queue so rapid navigation cannot overwrite a different question’s pending save.
- Manual submission flushes all answered questions before submission; failed saves are surfaced to the candidate.
- Automatic answer saving for selected options and debounced written responses.
- Question navigator and review flags.
- Server-side submission and objective scoring.
- Published-results view.

## Important examination integrity design

- Correct answers live in `question_answer_keys`, separate from questions and options.
- Candidate question content is delivered through `get_exam_session()` for that candidate's active session.
- Candidate answer saving verifies the session owner, question membership and server deadline.
- `submit_exam()` calculates objective marks on the server.
- Essays and unkeyed short answers are sent for manual marking.
- Candidates cannot read their post-submission answer rows or unpublished result rows.
- Results can be released immediately by exam configuration or later by an owner/admin.
- Activity monitoring records browser visibility and network events. These are indicators for human review, not proof of misconduct.

This is **not a fully offline examination client**. The candidate interface can recover after a connection returns and can resume from server-saved responses, but a network connection is required for live server-side saving and submission.

## Roles and controls

| Role | Primary access |
|---|---|
| Owner | Full institution control, membership management, question/exam administration, results release |
| Administrator | Institution administration, question/exam management, membership assignment (not owner/admin appointment), results release |
| Question setter | Subjects, banks, questions, exam setup and question linking |
| Invigilator | Active sessions and integrity events; no answer-key or result access |
| Examiner | Question content, submitted responses, manual marking and results |
| Candidate | Assigned exams, active candidate session and published personal results |

## Run and deploy

This is a static PWA. No build command is required.

- Build command: leave blank
- Output directory: `.`
- Root directory: repository root
- Entry point: `index.html`

The application uses the pinned Supabase JS ESM package version in `app.js`.

## Database state and migrations

The connected Supabase project has already been migrated and verified. See `database/MIGRATIONS-APPLIED.md` for the migration history recorded in the live database. **Do not rerun the database migrations against this existing project.** The project database is authoritative for this build. Before provisioning another project, export a current schema and migration set from the source Supabase project using the Supabase CLI or dashboard; this package is not a clean-room database restore archive.

## Production checks still required

- Confirm the owner can sign in through the deployed browser application.
- Confirm candidate signup and email confirmation behaviour.
- Confirm allowed redirect URLs and site URL in Supabase Auth.
- Enable Supabase leaked-password protection.
- Decide whether public candidate self-signup should remain enabled; unassigned accounts receive no institution role or exam access.
- Run live browser tests for question creation, exam publishing, assignment, timed attempt, answer autosave, deadline enforcement, submission, manual marking and result release.
- Test sign-out and password reset on desktop and mobile.
- Connect `cbt.ethandigitalacademy.org` and verify HTTPS.
- Perform a separate security review before high-stakes or external examinations.

## Files

- `index.html` — app entry point
- `app.js` — Supabase-connected frontend logic
- `styles.css` — responsive application styles
- `config.js` — public client configuration only
- `manifest.webmanifest`, `sw.js` — PWA shell
- `assets/` — academy brand assets
- `database/` — live database migration record and operational notes
- `docs/` — deployment and test checklists
