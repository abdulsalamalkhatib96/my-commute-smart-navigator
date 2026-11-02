FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /srv/app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
USER node
EXPOSE 8080
CMD ["node","src/server.mjs"]
