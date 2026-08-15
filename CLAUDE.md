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
- My resumes are in `.private/`; never commit them. Three variants share the
  same experience section and differ in the third project slot plus emphasis:
  - `YaoyiWang_Resume_AIops.tex` — infra / platform / DevOps / SRE / systems
    engineer, and the **default for general SDE**. Third project is the Mastodon
    scaling study (Linux/Nginx/TLS, load testing, failure modes).
  - `YaoyiWang_Resume_AIeng.tex` — AI engineer / LLM product roles. Third
    project is Job Tracker (Claude fit scorer); skills lead with LangGraph.
  - `YaoyiWang_Resume_AIinfra.tex` — **only** ML infra / AI infra / ML systems.
    The one that keeps the CUDA project; leads with the vLLM serving stack.
  Score a JD against all three and report **which version fits best and why**,
  not just a single number. Never suggest adding a skill or keyword that isn't
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