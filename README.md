# depsysweb

## TODO
*  Implement a process table
*  Implement a shell (depshell)
*  Implement a filesystem
*  Implement custom gl effects calls
*  Enable click and touch
*  Enable images

## Setup
* In wsl bash terminal
  * `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
* Clone depsysinc/xterm.js 
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
  * `yarn run esbuild-watch`
* Clone depsysinc/depsysweb
  * Dev Containers: Clone Repository in Named Container Volume (depsysweb)
```
cd /workspaces/xterm.js  # Optional
yarn link                # Optional
cd /workspaces/xterm.js/addons/addon-webgl
yarn link
cd /workspaces/depsysweb
yarn link @xterm/xterm   # Optional
yarn link @xterm/addon-webgl
```

## Development
*  yarn serve