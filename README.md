# depsysweb

## TODO
* process
  * argv
  * envp
  * docview
    * Paragraphs, sections
    * images
  * imageview
    * addon-image or custom?
  * dssh
    * search for executable in PATH
    * scripting
    * command history persistence
    * [tab] complete
    * chmod
* fs
  * BrowserStorage backed filesystem 
  * S3 backed filesystem
* Terminal
  * Implement custom gl effects calls
    * slow fuzzy warmup
      * Synchronize with first boot sequence
      * Make faster after recent boots (requires cookies)
  * Enable click and touch
  * Enable images
* /proc

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