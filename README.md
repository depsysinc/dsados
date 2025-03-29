# Development Setup

## Windows Subsystem for Linux (WSL2)
* Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)
* Make sure the installation is [set to version 2](https://learn.microsoft.com/en-us/windows/wsl/install#upgrade-version-from-wsl-1-to-wsl-2)

## Docker Desktop for Windows
* Install [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)

## GIT
* Install and set up [git](https://git-scm.com/downloads/win)
* Make sure you get added to the organization [depsysinc](https://github.com/depsysinc)

## Visual Studio Code
* Install [VSCode](https://code.visualstudio.com/Download)
* Install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
* Clone depsysinc/xterm.js 
  * Use the VSCode command "Dev Containers: Clone Repository in Named Container Volume" (depsysweb)
  * Switch git branches to the [crt branch](https://github.com/depsysinc/xterm.js/tree/crt)
  * In the terminal of the dev container, run `yarn run esbuild-watch` 
* Clone depsysinc/depsysweb
  * Use the VSCode command "Dev Containers: Clone Repository in Named Container Volume" (depsysweb)
  * NB: Repo links set up automatically by `init.sh`
* If you lose the window, go to the Remote Explorer tab and find depsysweb under Dev Containers.

### Troubleshooting
* If unix://var/docker socket disappears
  * Check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
* If VSCode fails silently for git actions
  * Open a wsl bash terminal and run:
    * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
* If developing in both depsysweb and xterm.js at the same time
  * Increase WSL memory to 16gb in `%UserProfile%\\.wslconfig`
    * `[wsl2]`
    * `memory=16gb`


# Development
## Live Update
* In the depsysweb dev container, run `yarn serve` in the terminal
* Go to Docker Desktop, find the newly active container, and open the [localhost](https://en.wikipedia.org/wiki/Localhost) link to view the page
* Notes:
  * The website will reload and update automatically when you make changes to source files
  * Changes will not be reflected on the official [depsys.io](https://depsys.io) until the website is deployed to AWS
  * Ctrl-C in the terminal will kill the site
* To run tests, run `yarn test` in the terminal (recommended before pushing)
  * Changes will not be reflected on the official [depsys.io](https://depsys.io) until you pull to the main repository
  * Ctrl-C in the terminal will kill the site


## Adding new file extensions
* jest.config.js
* webpack.config.js
* src/declarations.d.ts

# Notes
## Figlet
* slant - DepSys logo
* standard - page titles
