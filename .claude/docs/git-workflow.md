# Git Workflow — Branch Per User Story

## Branch naming
`feature/<phase-number>-<story-id>-<short-slug>`

Examples:
- `feature/1-b1-customer-list`
- `feature/1-b2-add-edit-customer`
- `feature/3-c3-itemized-bill-form`
- `feature/0-foundation` (Phase 0 has no numbered stories — use this)

Story IDs (A1, B2, C3, D1, etc.) come from Section 8 of the spec. If a
phase's prompt in Section 11 bundles several stories into one build step
(this happens in Phases 0, 2, 5, 6), you may do one branch per phase-prompt
instead of splitting further — but never mix two *different* phases'
stories on one branch.

## Step-by-step, for every story

1. Make sure you're starting from an up-to-date `main`:
   ```
   git checkout main
   git pull origin main
   ```
2. Create the story branch:
   ```
   git checkout -b feature/1-b1-customer-list
   ```
3. Implement the story, following `code-style.md` and `ui-guidelines.md`.
4. Verify before touching git any further:
   - `tsc --noEmit` is clean
   - The app actually runs (or the relevant screen renders / test passes)
   - The acceptance criteria for this specific story (spec Section 8) pass
5. If verification fails: keep iterating on this branch. Do not merge, do
   not push, do not move to the next story.
6. If verification passes: commit on the branch —
   ```
   git add -A
   git commit -m "Story B1: customer list with search and sort"
   git push -u origin feature/1-b1-customer-list
   ```
7. Merge into `main`:
   ```
   git checkout main
   git pull origin main
   git merge --no-ff feature/1-b1-customer-list -m "Merge: Story B1 — customer list"
   ```
   - If the merge has conflicts, resolve them, then re-run the verification
     in step 4 **again** on `main` before pushing — a clean merge can still
     break the build.
8. Push `main`:
   ```
   git push origin main
   ```
9. Delete the story branch, local and remote:
   ```
   git branch -d feature/1-b1-customer-list
   git push origin --delete feature/1-b1-customer-list
   ```
10. Update `.claude/PROGRESS.md` — check off the story, note the branch name
    and date — and fold that update into the merge commit (amend it) or a
    tiny follow-up commit directly on `main`.

## Rules
- Never force-push `main`.
- Never merge a branch whose build you haven't personally re-verified in
  this session — a build that passed an hour ago doesn't count if you've
  since touched shared files (schema, repository layer, i18n keys).
- If a story turns out to depend on another unmerged story, say so instead
  of silently branching from the wrong base — branch from that other story's
  branch instead of `main`, and note the dependency in the commit message.
- One story = one branch = one merge. Don't batch multiple stories into a
  single branch even if they're quick — the whole point is a clean,
  revertible unit per story.
