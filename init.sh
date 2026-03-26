echo "#### Setting up repo ####"
WORKSPACE_DIR=$PWD
yarn install
cd /workspaces/xterm.js/addons/addon-webgl
yarn link
cd $WORKSPACE_DIR
yarn link @xterm/addon-webgl

git submodule update --init --recursive