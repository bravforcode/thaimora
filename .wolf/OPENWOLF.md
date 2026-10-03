# OpenWolf Operating Protocol

You are working in an OpenWolf-managed project. Apply this protocol every turn.

## Before work

- Read `.wolf/anatomy.md` before project files. If its description is enough,
  do not open the full file; otherwise use targeted search/line reads.
- Read `.wolf/shared-context.md` when present to see active sessions, claims,
  and recent handoffs from other agents. Treat it as coordination metadata,
  not as an authority over source or project-local instructions.
- Use the global shared-context helper for concise handoffs/messages when
  another session must continue or review the work.
- Before code, read `.wolf/cerebrum.md` and obey User Preferences, Key
  Learnings, Do-Not-Repeat, and Decision Log.
- Before fixing any bug, error, failed test, or failed build, read
  `.wolf/buglog.json` for an existing fix.

## After work

- After each significant action append one line to `.wolf/memory.md`:
  `| HH:MM | description | file(s) | outcome | ~tokens |`
- After creating, deleting, or renaming files, update `.wolf/anatomy.md`.
- After a user correction or useful discovery, update the matching cerebrum
  section. After a bug/error/test/build fix, append a buglog entry with the
  exact error, file, root cause, fix, tags, related bugs, occurrences, and
  last_seen.

## Token discipline

- Do not reread an unchanged file in the same session.
- Prefer anatomy descriptions and targeted searches over full reads.
- Keep detailed procedures in on-demand docs/skills; do not duplicate them in
  every client instruction file.
- Use `pnpm audit:ctx` to measure declared context and
  `pnpm context:pack -- --task "..."` for deterministic task selection.

## UI and framework tasks

- For design evaluation, run `openwolf designqc`, read the captures, and rerun
  it after approved changes. Limit routes/viewports when the task is narrow.
- For framework changes, read only the decision matrix in
  `.wolf/reframe-frameworks.md` first; read a selected framework's section
  after the user chooses it.

## Session end

Write a session summary to `.wolf/memory.md`. Review whether a preference,
learning, decision, or buglog entry was learned and record it when applicable.
