# Dockerfile
FROM node:22-alpine

WORKDIR /app

# instala deps
COPY package*.json ./
RUN npm ci --omit=dev

# copia código
COPY src ./src
ENV NODE_ENV=production

CMD ["node", "src/index-customers.js"]
