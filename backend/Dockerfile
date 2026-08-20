FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN mkdir -p /app/outbox && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 4000
USER node

CMD ["node", "server.js"]
