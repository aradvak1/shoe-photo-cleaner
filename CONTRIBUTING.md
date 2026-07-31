# Contributing

This is a private, proprietary project (see [LICENSE](LICENSE)) — it isn't open to public pull requests. This file is for anyone the project owner has given direct access to work on the codebase.

## Getting set up

Follow the [README](README.md) for installing dependencies, configuring environment variables, and running the database migrations before making changes.

## Workflow

1. Create a branch off `master` for your change.
2. Run the app locally (`npm run dev`) and verify the change end-to-end in the browser before opening a PR — this project has no automated test suite, so manual verification is the safety net.
3. Run `npm run build` and `npm run lint` before pushing; both should pass cleanly.
4. Open a PR against `master` with a short description of what changed and why.

## Conventions

- **Framework**: Next.js (App Router) + TypeScript + Tailwind v4 (CSS-first theming — see `src/app/globals.css` for the design tokens). See `AGENTS.md` for framework-version-specific notes before writing code.
- **Language**: the UI is Hebrew/RTL throughout (`<html lang="he" dir="rtl">`); keep new UI text in Hebrew and RTL-correct.
- **Styling**: reuse existing components in `src/components/ui/` (`Button`, `Card`, `Dialog`, etc.) rather than one-off markup — they carry the shared design system and motion/press feedback.
- **Commits**: write commit messages that explain *why* a change was made, not just what changed.
- **Secrets**: never commit `.env.local` or any real API keys/credentials — `.gitignore` already excludes it, keep it that way.

## Reporting issues

If you've found a bug or have a suggestion, open a GitHub issue describing the problem, steps to reproduce, and expected vs. actual behavior.
