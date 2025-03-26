# Development Setup

## Windows Subsystem for Linux (WSL2)
* Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)
* Make sure the installation is [set to version 2](https://learn.microsoft.com/en-us/windows/wsl/install#upgrade-version-from-wsl-1-to-wsl-2)

## Docker Desktop for Windows
* Install [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)

### Troubleshooting
* If unix://var/docker socket disappears
  * Check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
* If vscode fails silently for git actions
  * Open a wsl bash terminal and run:
    * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
* If developing in both depsysweb and xterm.js at the same time
  * Increase wsl mem to 16gb in `%UserProfile%\\.wslconfig`
    * `[wsl2]`
    * `memory=16gb`

## GIT
* Install [git](https://git-scm.com/downloads/win)

## Visual Studio Code
* Install [VSCode](https://code.visualstudio.com/Download)
* Install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
* Clone depsysinc/xterm.js 
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
  * `yarn run esbuild-watch`
* Clone depsysinc/depsysweb
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
  * NB: Repo links set up automatically by `init.sh`

# Development
## Live Update
* `yarn serve`
## Adding new file extensions
* jest.config.js
* webpack.config.js
* src/declarations.d.ts

# Notes
## Figlet
* slant - DepSys logo
* standard - page titles
