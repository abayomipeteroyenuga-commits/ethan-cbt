# ETHAN CBT — Project status (3 November 2026)

## Live infrastructure
- Supabase project: `ethan-cbt`
- Project ref: `juumaqmkcmfpexgpzpfy`
- Region: `eu-west-1` (Ireland)
- Status: `ACTIVE_HEALTHY`
- Database: PostgreSQL 17
- Project URL: `https://juumaqmkcmfpexgpzpfy.supabase.co`
- Institution: Ethan Digital Academy (`ethan-digital-academy`)
- Verified owner account: `fedora4jesus@gmail.com` (role `owner`, membership `active`)

## Database foundation
- 17 public tables created; all 17 have RLS enabled.
- No anonymous table grants.
- Application RPCs are executable by `authenticated`; the audited app RPCs are not executable by `anon`.
- Timed exam start/resume, candidate-safe question snapshots, answer persistence, server-side objective scoring, manual marking, result release and event logging are implemented in database functions.
- Fifteen database migrations are recorded in the live project. Do not replay them on this project.

## Current application package
`ETHAN CBT v0.2.1` is a static PWA frontend connected to the live Supabase project. It includes owner/staff/candidate authentication and role-aware workspaces, subjects, question banks, question authoring, exam creation/publishing, member assignment, candidate exam runner, results/manual marking, invigilation activity and CSV result export.

Candidate answers are stored and scored server-side. The question-answer key table is separate from candidate-visible questions. Candidate exam content is supplied through a session RPC; candidate result visibility is restricted until official release. The frontend includes a per-question autosave queue and pre-submit answer flush.

## Outstanding before production
1. Enable leaked-password protection in Supabase Auth.
2. Decide and verify candidate self-signup policy; unassigned accounts have no institution access.
3. Set Supabase Site URL and allowed redirect URLs for the production domain.
4. Create a dedicated GitHub repository and upload the extracted v0.2.1 package contents.
5. Import into Vercel as a static site (no build command, output directory `.`).
6. Connect `cbt.ethandigitalacademy.org` and verify HTTPS.
7. Test live owner login/sign-out, registration, password reset, question authoring, exam publishing, candidate assignment, timed attempt, autosave/reconnect, submission, manual marking and result release in a real browser.
8. Run concurrent-candidate load tests and commission a separate security review before high-stakes exams.

## Known limitations
- Browser end-to-end testing is not yet completed; local browser execution was blocked in this environment.
- No full offline CBT mode.
- No QTI import/export yet.
- No accredited remote-proctoring integration or guarantee against cheating.
- Supabase Security Advisor still flags authenticated-executable `SECURITY DEFINER` RPCs for review; these are intentional protected application RPCs with explicit caller/role/session checks. Leaked-password protection is currently disabled.
