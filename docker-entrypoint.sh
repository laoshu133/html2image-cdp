#!/bin/bash
set -ex

source $HOME/.bashrc

workdir=$(pwd)
actCode=$1

# Debug
echo node: $(node -v)
echo npm: $(npm -v)

# Init ENV
export NODE_LOG_DIR=/tmp
export ENABLE_NODE_LOG=YES

# Init agentx
ENABLE_NODE_LOG=NO node alinode.default.js

# App actions
case "$actCode" in
  install)
      # 安装应用（对于编译型语言，忽略使用）
      yarn --production
    ;;
  start)
      # 启动应用
      node index.js
    ;;
  stop)
      # 停止应用
    ;;
  *)
    echo "actCode=${actCode} is invalid." > /dev/stderr
    exit 1
    ;;
esac
