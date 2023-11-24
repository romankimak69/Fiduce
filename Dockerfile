FROM node:13-alpine
ENV TERM xterm-256color
ENV NODE_ENV production

RUN apk update && apk upgrade && apk add --no-cache make gcc g++ python bash git

WORKDIR /app

# node_modules will not be copied according to .dockerignore file rules
COPY . .
RUN npm ci --only=production

RUN apk del make gcc g++ python

EXPOSE 3000

ENTRYPOINT ["node", "app.js"]