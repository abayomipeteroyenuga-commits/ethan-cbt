# ETHAN CBT live migration history

Project reference: `juumaqmkcmfpexgpzpfy`  
Project name: `ethan-cbt`  
Region: `eu-west-1` (Ireland)  
Database engine: PostgreSQL 17

The following 15 migrations are recorded in the connected Supabase project as of 3 November 2026:

1. `ethan_cbt_schema_foundation_v0_1` — 17 institution-scoped tables, foreign keys, base indexes, private role helpers, RLS policies and auth profile trigger.
2. `ethan_cbt_exam_engine_v0_1` — exam start/resume, candidate-safe session reads, answer persistence, submission scoring, manual marking and event logging functions.
3. `ethan_cbt_rls_performance_indexes_v0_1` — query indexes, policy overlap cleanup and auth policy optimisations.
4. `ethan_cbt_rls_results_policy_cleanup` — initial results policy cleanup.
5. `ethan_cbt_remove_legacy_results_policy` — removal of the duplicate legacy results read policy.
6. `ethan_cbt_institution_member_admin_v0_1` — institution member listing and controlled member-role management RPCs.
7. `ethan_cbt_candidate_data_isolation_v0_1` — same-institution profile access, staff-only direct exam/question table reads and deadline-aware session retrieval.
8. `ethan_cbt_withhold_unpublished_scores_v0_1` — suppresses unpublished scores in candidate submission RPC responses.
9. `ethan_cbt_atomic_question_authoring_v0_1` — server-side atomic question/options/answer-key creation.
10. `ethan_cbt_result_release_and_candidate_results_v0_1` — owner/admin result release and candidate-only published results RPC.
11. `ethan_cbt_membership_rbac_null_guard_v0_1` — explicit null-role rejection and admin/owner membership boundaries.
12. `ethan_cbt_hide_post_submission_marking_rows_v0_1` — candidate answer rows inaccessible after submission until permitted staff review.
13. `ethan_cbt_candidate_attempt_visibility_v0_1` — candidate attempt counts in assigned exam list.
14. `ethan_cbt_examiner_only_marking_data_v0_1` — limits submitted answer and result access to owner/admin/examiner roles; invigilators retain session/event monitoring.
15. `ethan_cbt_prevent_owner_self_suspension_v0_1` — prevents owner/admin from suspending or removing their own administrative access through the member-management RPC.

## Verification at the live project

- 17 public base tables present.
- 17 of 17 public tables have RLS enabled.
- No public `anon` table privileges for SELECT, INSERT, UPDATE or DELETE.
- Candidate and staff-facing RPCs in `public` have `EXECUTE` for `authenticated`; the audited set has no `EXECUTE` for `anon`.
- Owner membership for `fedora4jesus@gmail.com` is active in Ethan Digital Academy.
- Simulated authenticated owner question-authoring transaction succeeded and was rolled back (no test question retained).
- Simulated non-member call to membership management was rejected.
- Published-results RPC returns only the signed-in candidate's released records.

## Advisor notes

The Supabase Security Advisor reports authenticated-executable `SECURITY DEFINER` functions. They are deliberate application RPCs with explicit authentication and per-institution, per-session or role checks. These warnings still warrant periodic review and a separate security audit. The advisor also reports leaked-password protection disabled; enable this in Supabase Authentication password-security settings before production. Performance Advisor reports unused indexes while the database is new and has not yet processed production workload.

**Do not replay these migration names against the already-migrated production project.** For a separate environment, export a fresh schema and migration archive from the source project with the Supabase CLI or dashboard.
