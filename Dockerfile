FROM node:22-bookworm-slim

# Install system dependencies for canvas/skia and GIS tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches/ ./patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Declare build-time args for VITE variables (must be present at build time)
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_FRONTEND_FORGE_API_URL
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_APP_TITLE

# Export them as env vars so Vite picks them up during build
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_FRONTEND_FORGE_API_URL=$VITE_FRONTEND_FORGE_API_URL
ENV VITE_FRONTEND_FORGE_API_KEY=$VITE_FRONTEND_FORGE_API_KEY
ENV VITE_APP_TITLE=$VITE_APP_TITLE

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
