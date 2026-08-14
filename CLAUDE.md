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
- My resume is in `.private/`. Use it for the fit scorer; never commit it.