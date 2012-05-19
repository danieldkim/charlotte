DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
NODE_PATH=$NODE_PATH:./lib mocha out/standalone/* && phantomjs run_browser_tests.js