##
# This Dockerfile sets up a multi-stage build for the Node.js WebSocket server.
# It creates a 'builder' stage for compilation and Prisma client generation (including dev dependencies).
# And a 'runner' stage for a lean production image with only runtime dependencies.
##

# --- Builder Stage (for building app and migrations) ---
FROM node:22 AS builder

WORKDIR /app

# Install build dependencies required for native modules (like node-pty)
# python3 and build-essential are needed by node-gyp
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json for dependency installation
# Use COPY with wildcard to handle both package.json and package-lock.json/yarn.lock/pnpm-lock.yaml
COPY package*.json ./

# Install all dependencies, including devDependencies for TypeScript compilation and Prisma CLI
# This image will be used for `prisma migrate deploy` in an init container in Kubernetes
RUN npm install

# Copy Prisma schema and tsconfig for the build
COPY prisma ./prisma/
COPY tsconfig.json ./

# Copy source code
COPY src ./src/

# Build the TypeScript project and generate Prisma client
# `npm run build` as defined in package.json includes `npx prisma generate` and `tsc`
RUN npm run build

# --- Production Runner Stage (lean image for runtime) ---
FROM node:22 AS runner

WORKDIR /app

# Set environment variables for production
ENV NODE_ENV production
ENV PORT 3000

# Copy package.json and package-lock.json to install only production dependencies
COPY package*.json ./
# Install only production dependencies
# --omit=dev ensures dev dependencies like 'prisma' and 'typescript' are not installed
RUN npm install --omit=dev

# Copy the built application code from the builder stage
COPY --from=builder /app/dist ./dist/

# Copy the Prisma schema, which is needed by @prisma/client at runtime
# and for any potential introspection/seed operations (though migrations are handled by initContainer)
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
