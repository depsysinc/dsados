# depsysweb

## TODO
* fs
  * writeable files in DSIDBFileSystem <--->
  * S3 backed filesystem
* general
  * Exceptions
    * make all prototypes explicit
    * Switch all tests to test type rather than err string
* terminal
  * fix resize to not do linear search of font sizes to get proper size
  * custom framebuffer pipeline
    * create framerender callback hook
    * pull out effects into depsysweb

Render text to text texture
Pass text texture to processing chain
render(sourceTexture)
final link in the chain renders to the default framebuffer.0

  * different fonts for different vintages of computer
  * Implement custom gl effects calls
    * slow fuzzy warmup
      * Make faster after recent boots (requires cookies)
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
  * docview
    * Paragraphs, sections
    * images
  * imgview
    * addon-image or custom?

## Setup
* [enable docker support in wsl 2 distros](https://docs.docker.com/desktop/features/wsl/#enabling-docker-support-in-wsl-2-distros)
  * NB: If unix://var/docker socket disappears, check `DockerDesktop->Settings->Resources->WSL Integration->Enable Integration with default distro`
  * NB: If dev in both depsysweb and xterm.js, up wsl mem to 16gb in `%UserProfile%\\.wslconfig`
    * `[wsl2]`
    * `memory=16gb`
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