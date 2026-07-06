# startboard — packaged as a tiny CLI image. Zero runtime deps.
FROM node:22-alpine

WORKDIR /app

# No dependencies to install; copy the source and register the bin.
COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY examples ./examples

# Make `startboard` available on PATH inside the image.
RUN ln -s /app/bin/startboard.js /usr/local/bin/startboard \
 && chmod +x /app/bin/startboard.js

# Mount your configs and read/write generated boards under /work.
WORKDIR /work
ENTRYPOINT ["startboard"]
CMD ["help"]
