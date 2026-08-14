# CLAUDE.md

Personal job-search web app (Discover + Track).

Before doing anything, read **`.private/SPEC.md`** (the full spec) and
**`.private/preferences.md`** (my criteria). These live in `.private/`, which is
gitignored — they stay on my machine and are never pushed to GitHub. You can
still open and read them directly; gitignore only controls what gets pushed, not
what you can read locally. If automatic search ever skips them, just open the
paths directly.

## Working rules
- **Plan-first.** Give me a plan + final schema + file tree, wait for my
  approval, then go phase by phase with manual approval.
- `.private/SPEC.md` is the source of truth. `scripts/find_jobs.py` is reference
  only for the location-tagging approach — follow SPEC.md where they differ.
- My resumes are in `.private/`; never commit them. There are two, same
  experience section, different project ordering and emphasis:
  - `resume-infra.tex` — **A**: infra / platform / DevOps / SRE. Also the
    default for general SDE roles.
  - `resume-mlinfra.tex` — **B**: ML infra / ML systems / AI platform. Leads
    with the LLM serving stack and CUDA work.
  Score a JD against both and report **which version fits better and why**, not
  just a single number. Never suggest adding a skill or keyword that isn't
  backed by something in my repos — say "no evidence" instead.
- **Scoped TDD.** Pure logic / lib functions (dedupe, scope + location tagging,
  prefill guards + metadata extraction, the fit scorer) are **test-first**: write
  the failing test, then implement. UI components + exploratory code (tables,
  Kanban, dialogs) are **implement-first, then cover** with tests for the
  important behavior — do NOT force test-first on UI.
- **Tests are the verification.** Every phase's verification lands as repeatable
  tests in `tests/` (Vitest, `npm test`), not one-off manual runs. Keep the
  plan-first + ROADMAP tick + devlog cadence; that already IS our spec-driven
  process — don't add a heavier framework on top.