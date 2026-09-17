# Instance broker: plain Node, no npm install, no dependencies to audit.
FROM node:22-alpine

WORKDIR /app

COPY server.mjs ./
COPY lib ./lib

# Runs as the image's unprivileged user; it never touches the Docker socket, only the
# scoped socket proxy over HTTP.
USER node

CMD ["node", "server.mjs"]
