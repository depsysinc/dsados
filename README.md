# depsysweb

## TODO
* process
  * implement environment variables
* Implement a file subsystem
  * Add file Inode types
    * refactor filetypes into their own modules
    * add process filetype
    * change exec to take DSProcessFile
    * move init into process
    * add processes to genrootfs
  * S3 backed filesystem
  * BrowserStorage backed filesystem 
* /proc
* dssh
  * implement search for executable in PATH
  * handle scripting
  * implement command history persistence
*  Implement custom gl effects calls
  * Implement slow fuzzy warmup
  * Synchronize with first boot sequence
  * Make faster after recent boots
*  Enable click and touch
*  Enable images

## Setup
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)
  * NB: If unix://var/docker socket disappears, check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
* In wsl bash terminal
  * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
* Clone depsysinc/xterm.js 
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
  * `yarn run esbuild-watch`
* Clone depsysinc/depsysweb
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
```
cd /workspaces/xterm.js/addons/addon-webgl
yarn link
cd /workspaces/depsysweb
yarn link @xterm/addon-webgl
```

## Development
*  yarn serve