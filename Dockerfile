# Works with both Docker and Podman (fully-qualified base image avoids Podman's short-name prompt)
FROM docker.io/library/node:22-alpine
WORKDIR /app
COPY server.js ./
COPY web ./web
RUN mkdir -p /data && chown node:node /data
ENV PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "server.js"]
