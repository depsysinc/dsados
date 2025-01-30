# TODO
* fs
  * writeable files in DSIDBFileSystem
  * S3 backed filesystem
* general
  * Get PANIC to suggest clearing cache
  * Exceptions
    * make all prototypes explicit
    * Switch all tests to test type rather than err string
* terminal
  * FIXME resize to not do linear search of font sizes to get proper size
  * update scanline filter to choose a definite line as center (avoid weird moire patterns or dim renders)
  * Enable click and touch
  * Enable images
* process
  * autoexec.dssh
    * look for profile in /local/
  * dssh
    * [tab] complete
    * command history persistence across boots <--->
  * chmod
  * nvram
  * mv
  * cp
  * dsmdbrowser
    * Fix coordinate translation due to canvas centering in containing div (maybe fix in DSApp or DSTerminal)
    * Implement img links
    * Implement explicit linebreaks
    * Implement scroll persistence in browser history
  * imgview

# Setup
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)
  * NB: If unix://var/docker socket disappears, check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
  * NB: If dev in both depsysweb and xterm.js, up wsl mem to 16gb in `%UserProfile%\\.wslconfig`
    * `[wsl2]`
    * `memory=16gb`
* NB: If silent failure happens in vscode for git actions: in wsl bash terminal
  * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
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