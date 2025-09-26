# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies, including devDependencies for building
RUN npm install

# Copy TypeScript source files and tsconfig
COPY tsconfig.json .
COPY src ./src

# Build the project
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built JavaScript code from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy the startup script
COPY start.sh .
RUN chmod +x ./start.sh

# Expose both API and SSE ports
EXPOSE 3001 3002

# Command to run the application
CMD ["./start.sh"]