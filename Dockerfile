# Build Stage 1
FROM node:22-alpine AS build
WORKDIR /app

# Copy package.json and your lockfile
COPY package.json package-lock.json ./

# Install dependencies using npm
RUN npm install

# Copy the entire project
COPY . ./

# Build the project
RUN npm run build

# Build Stage 2
FROM node:22-alpine
WORKDIR /app

# Only `.output` folder is needed from the build stage
COPY --from=build /app/.output ./.output

# Change the port and host
ENV PORT 3110
ENV HOST 0.0.0.0

EXPOSE 3110

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3110/ || exit 1

CMD ["node", ".output/server/index.mjs"]
