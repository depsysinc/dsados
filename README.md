```
======================================
     ____            _____
    / __ \___  ____ / ___/__  _______
   / / / / _ \/ __ \\__ \/ / / / ___/
  / /_/ /  __/ /_/ /__/ / /_/ (__  )
 /_____/\___/ .___/____/\__, /____/
           /_/         /____/
======================================

DSADOS V0.1

Deprecated Systems
    Autonomous Distributed
        Operating System

<c> 2026 Deprecated Systems Incorporated
____
```
DSADOS is a browser-based, single threaded, *operating system like* environment styled after early DOS-era computing. It presents a fully interactive terminal interface with a custom shell, virtual filesystem, process model, and CRT visual effects — all running client-side in the browser.

It is the framework layer of DOS-style web experiences, such as the [depsys.io](https://depsys.io) web site. Site-specific content is layered on top via separate private repos.

## DEMO
Visit a demo version of the vanilla build at the [github pages site](https://depsysinc.github.io/dsados/)

## Features

- **dssh** — a bash/sh style shell
  - stack based script execution with variables and tests
- **Virtual filesystem**
  - backends: RAM, IndexedDB (persistent)
  - filetypes: static files, web-fetched files, and binary (typescript)
- **Process model** — process stack, ENV vars, streams, kernel service api
- **CRT renderer** — bloom, scanlines, sprite, and screen effects via a custom [xterm.js](https://github.com/depsysinc/xterm.js/tree/crt) fork
- **Markdown browser** (`dsmdbrowser`) — renders *markdown like* documents in-terminal
- **Image viewer** (`imgview`) — renders images in the terminal
- **Demo programs** — animation, curses-style UI, mouse/touch, pixel art

## Architecture

```
src/
  dsKernel.ts           — kernel: boots the system, coordinates subsystems

  dsTerminal.ts         — terminal I/O layer (wraps xterm.js)
  renderer/             — CRT visual effect renderers

  dsProcess.ts/dsApp.ts — process/app base classes
  dsStream.ts           — inter-process streams

  dsFileSystem.ts       — filesystem interface
  filesystem/           — filesystem backend implementations
  rootfs/               — layered filesystem roots
```

Depends on [depsysinc/xterm.js](https://github.com/depsysinc/xterm.js/tree/crt) (`crt` branch), which must be cloned and `yarn link`ed into this repo in the shared Docker volume (see [Development Setup](#development-setup))


# Development Setup

## Windows Subsystem for Linux (WSL2)
* Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)
* Make sure the installation is [set to version 2](https://learn.microsoft.com/en-us/windows/wsl/install#upgrade-version-from-wsl-1-to-wsl-2)

## Docker Desktop for Windows
* Install [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)

## GIT
* Install and set up [git](https://git-scm.com/downloads/win)

## Visual Studio Code
* Install [VSCode](https://code.visualstudio.com/Download)
* Install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
* Clone depsysinc/xterm.js
  * Use the VSCode command "Dev Containers: Clone Repository in Named Container Volume" (dsados)
  * Switch git branches to the [crt branch](https://github.com/depsysinc/xterm.js/tree/crt)
  * In the terminal of the dev container, run `yarn run esbuild-watch`
* Clone depsysinc/dsados
  * Use the VSCode command "Dev Containers: Clone Repository in Named Container Volume" (dsados)
  * NB: Repo links set up automatically by `init.sh`
* If you lose the window, go to the Remote Explorer tab and find dsados under Dev Containers.

### Troubleshooting
* If unix://var/docker socket disappears
  * Check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
* If VSCode fails silently for git actions
  * Open a wsl bash terminal and run:
    * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
* If developing in both dsados and xterm.js at the same time
  * Increase WSL memory to 16gb in `%UserProfile%\\.wslconfig`
    * `[wsl2]`
    * `memory=16gb`


# Development

## Live Update
* In the dsados dev container, run `yarn serve` in the terminal
* Open [localhost:8080](http://localhost:8080) link to view the page
  * Will reload and update automatically when you make changes to source files
  * Ctrl-C in the terminal will kill the site
  * *Note:* New files require a restart of yarn serve to pick up
* To run tests, run `yarn test` in the terminal (recommended before pushing)

## Contributing
Submit an [issue](https://github.com/depsysinc/dsados/issues), then
* fork, work, commit, submit (a PR)

## Adding new file extensions
The framework must know how to handle all file extensions it sees when building.  There are three locations which must be updated when introducing a file with a new extension:
* [jest.config.js](https://github.com/depsysinc/dsados/blob/c7098cc75aacbb1cc5c8104a83ee67220a983c7b/jest.config.js#L12)
* [webpack.config.js](https://github.com/depsysinc/dsados/blob/c7098cc75aacbb1cc5c8104a83ee67220a983c7b/webpack.config.js#L51)
* [src/declarations.d.ts](https://github.com/depsysinc/dsados/blob/main/src/declarations.d.ts)

# Misc
## Figlet
ASCII art fonts used:
* slant - DepSys logo
* standard - page titles

# License
MIT — see [LICENSE](LICENSE)

# Contributors
- Michael Gentili
- Nicholas Waslander