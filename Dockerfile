# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY scripts/clean-dist.mjs ./scripts/clean-dist.mjs
COPY src/ ./src/
RUN npm run build && find dist -type f -name '*.map' -delete

RUN mkdir -p /site && cp -R dist /site/dist
COPY index.html /site/index.html
COPY styles/ /site/styles/
COPY audio/music-ratchet-theory.mp3 audio/music-last-light-relay.mp3 audio/music-breach-protocol.mp3 audio/music-black-channel.mp3 audio/music-sporewake.mp3 audio/music-rootmind.mp3 /site/audio/
COPY assets/portraits/ /site/assets/portraits/
RUN find /site -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \) \
      -exec gzip -9 -k {} \;

FROM nginxinc/nginx-unprivileged:1.28-alpine
USER root
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/ /usr/share/nginx/html/
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
