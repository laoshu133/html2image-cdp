FROM ubuntu:14.04
LABEL maintainer "admin@laoshu133.com"

# Expose
EXPOSE 3007

# libvips
ENV LIBVIPS_VERSION 8.5.5

# alinode-v2.2.3 with Node.js v6.11.3
ENV ALINODE_VERSION 2.2.3
ENV TNVM_DIR /root/.tnvm

# Use "bash" as replacement for	"sh"
# https://github.com/moby/moby/issues/8100#issue-43075601
RUN rm /bin/sh && ln -sf /bin/bash /bin/sh

# Install dependencies
RUN \
  apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
  automake g++ build-essential curl wget \
  gobject-introspection gtk-doc-tools libglib2.0-dev libpng12-dev \
  libwebp-dev libtiff5-dev libgif-dev libexif-dev libxml2-dev libjpeg-turbo8-dev libpoppler-glib-dev \
  swig libmagickwand-dev libpango1.0-dev libmatio-dev libopenslide-dev libcfitsio3-dev \
  libgsf-1-dev fftw3-dev liborc-0.4-dev librsvg2-dev

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

# Install tnvm
RUN \
  wget -O- https://raw.githubusercontent.com/aliyun-node/tnvm/master/install.sh | bash && \
  # source $HOME/.bashrc && \
  . $TNVM_DIR/tnvm.sh && \
  tnvm install alinode-v$ALINODE_VERSION && \
  tnvm use alinode-v$ALINODE_VERSION

# Update PATH
ENV PATH $TNVM_DIR/versions/alinode/v$ALINODE_VERSION/bin:$PATH

# Clean up
RUN \
  #apt-get remove -y curl && \
  apt-get remove -y automake build-essential && \
  apt-get autoremove -y && \
  apt-get autoclean && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Init app
COPY . /usr/src/app
WORKDIR /usr/src/app
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD [ "npm", "start" ]

# Install node deps
RUN \
  # npm, agentx, commandx
  # npm install -g npm && \
  npm install -g agentx commandx && \
  npm install
