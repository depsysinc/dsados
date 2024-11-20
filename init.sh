echo "Setting up depsysweb repo"
yarn install
cd /workspaces/xterm.js/addons/addon-webgl
yarn link
cd /workspaces/depsysweb
yarn link @xterm/addon-webgl