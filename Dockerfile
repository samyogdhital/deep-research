FROM node:18-alpine

WORKDIR /app

COPY deep-research/. .
COPY deep-research/package.json ./
COPY deep-research/.env.local ./.env.local

RUN npm install

CMD ["npm", "run", "docker"]
