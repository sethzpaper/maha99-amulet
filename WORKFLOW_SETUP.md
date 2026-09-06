# Video Workflow

Apply supabase/migrations/202609060002_video_workflow.sql after the verified
Auth/RLS migration. No live database migration has been run from this workspace.

The board uses the existing videos table. Existing records already marked posted
on Facebook or TikTok start at published; other records start at idea without
an assigned employee or due date. Assign an employee and date before production.
This rollout does not infer approval history from old records.

Allowed transitions: idea -> production -> review -> approved -> published.
Production can return to idea; review to production; approved to review.
Published work can reopen in production. Both the UI and database enforce this.
The status is a manual workflow record; it does not publish to social platforms.

Today uses Asia/Bangkok dates. A task due today is not overdue until the following
day. Published tasks are excluded from due/overdue lists. Pending leave requests
include past and future requests so none disappear unreviewed.

Admin-only access follows the existing RLS policies. Updates check workflow_version
to detect conflicting edits. Leave decisions update only pending requests.
Load/save errors remain visible and never fall back to demo/local records.

Tests: npm test; npm run lint; npm run build. tests/workflow-ui.cjs uses isolated
browser fixtures to cover workflow and leave actions without live DB credentials.
