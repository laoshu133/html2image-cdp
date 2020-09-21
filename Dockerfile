FROM ubuntu:16.04
LABEL maintainer "xiaomi@gaoding.com"

# 基础环境配置
ARG PORT=3007
ARG TZ=Asia/Shanghai
ARG NODE_ENV=production
ARG APP_INSTALL_DIR=/usr/src/app

# ALINODE 监控平台
# ARG ALINODE_APP_SECRET
# ARG ALINODE_APP_ID

ENV TZ $TZ
ENV PORT $PORT
ENV NODE_ENV $NODE_ENV
WORKDIR ${APP_INSTALL_DIR}

# libvips
ENV LIBVIPS_VERSION 8.5.5

# Expose
EXPOSE ${PORT}

# Health check
HEALTHCHECK --timeout=10s \
  CMD curl --silent --fail localhost:${PORT} || exit 1

# Install base deps
RUN \
  apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
  automake g++ build-essential curl wget \
  gobject-introspection gtk-doc-tools libglib2.0-dev libpng12-dev \
  libwebp-dev libtiff5-dev libgif-dev libexif-dev libxml2-dev libjpeg-turbo8-dev libpoppler-glib-dev \
  swig libmagickwand-dev libpango1.0-dev libmatio-dev libopenslide-dev libcfitsio3-dev \
  libgsf-1-dev fftw3-dev liborc-0.4-dev librsvg2-dev && \
  curl https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64 -Lo /usr/bin/dumb-init && \
  chmod +x /usr/bin/dumb-init

# Install libvips
RUN \
  cd /tmp && \
  curl -O -L -C - https://github.com/jcupitt/libvips/releases/download/v$LIBVIPS_VERSION/vips-$LIBVIPS_VERSION.tar.gz && \
  tar zvxf vips-$LIBVIPS_VERSION.tar.gz && \
  cd /tmp/vips-$LIBVIPS_VERSION && \
  ./configure --enable-debug=no --without-python $1 && \
  make && \
  make install && \
  ldconfig

# Install Node.js with alinode
# alinode-v4.7.2 with Node.js v10.15.3
ENV ALINODE_VERSION 4.7.2
ENV TNVM_DIR /root/.tnvm
# ENV TNVM_BASEURL https://raw.githubusercontent.com/aliyun-node/tnvm/master
ENV TNVM_BASEURL https://gitee.com/laoshu133/tnvm/raw/master
ENV NVM_SOURCE_URL ${TNVM_BASEURL}/tnvm.sh

# Update PATH
ENV PATH $TNVM_DIR/versions/alinode/v$ALINODE_VERSION/bin:$PATH

# Use "bash" as replacement for	"sh"
# https://github.com/moby/moby/issues/8100#issue-43075601
RUN rm /bin/sh && ln -sf /bin/bash /bin/sh

# Install tnvm, Node.js
RUN \
  bash -c "$(curl -fsSL ${TNVM_BASEURL}/install.sh)" && \
  . $TNVM_DIR/tnvm.sh && \
  tnvm install alinode-v$ALINODE_VERSION && \
  tnvm use alinode-v$ALINODE_VERSION

# Install Node.js global deps
RUN \
  echo "registry=https://registry.npm.taobao.org/" > ~/.npmrc && \
  npm install -g yarn @alicloud/agenthub

# Clean up
RUN \
  #apt-get remove -y curl && \
  apt-get remove -y automake build-essential && \
  apt-get autoremove -y && \
  apt-get autoclean && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*


# Copy files
COPY . .

# 安装应用
RUN ./docker-entrypoint.sh install

# 应用启动
ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]
CMD [ "start" ]

# 应用停止
#CMD [ "./docker-entrypoint.sh", "stop" ]
