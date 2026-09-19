FROM node:24-alpine AS build
WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server
COPY server/src ./server/src
COPY server/scripts ./server/scripts
COPY server/tsconfig.json ./server/tsconfig.json
RUN npm run build --prefix server

FROM node:24-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /build/server/dist ./dist
ENV HOST=0.0.0.0 PORT=8787
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
