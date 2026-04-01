# START PROJECT

## Project
**dsados** — Deprecated Systems Autonomous Distributed Operating System
- A browser-based OS environment built on a custom xterm.js fork
- Part of the **depsysweb** initiative (Owner's 90s-DOS-style web framework)
- Repo: `depsysinc/dsados`

## Key References
- **[README.md](README.md)** — Dev environment setup (WSL2, Docker Desktop, VSCode devcontainer, yarn commands)
- **[TODO.md](TODO.md)** — Active work items (filesystem, terminal, shell, process subsystem, dsmdbrowser)

## Tech Stack
- TypeScript, Webpack, Jest
- Depends on `depsysinc/xterm.js` (crt branch) — mounted alongside this repo in the `dsados` container volume

## Dev Workflow
- `yarn serve` — live-reloading dev server (access via Docker Desktop localhost link)
- `yarn test` — Jest test suite (run before pushing)
- Changes to xterm.js: run `yarn run esbuild-watch` in the xterm.js container

## Current Status
- Active development; see [TODO.md](TODO.md) for open items
- Current branch: `109-rework-repo-to-be-opensource-friendly`

## Active Issue
**depsysinc/dsados#109** — "Rework repo to be opensource friendly"
- This is the primary tracking issue for the current refactor/OSS migration work
- Read it with: `gh api repos/depsysinc/dsados/issues/109`
- Update it with: `gh api --method PATCH repos/depsysinc/dsados/issues/109 --field body='...'`
- Note: `gh issue view` triggers a deprecation warning (Projects classic); use `gh api` directly instead

# END PROJECT
