FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install root & client dependencies
RUN npm install
RUN npm --prefix client install

# Copy source code
COPY . .

# Build React client
RUN npm --prefix client run build

# Create persistent storage directories
RUN mkdir -p /app/data /app/uploads

# Expose port (default 3001, or custom $PORT)
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

# Start single-service web application
CMD ["node", "server/server.js"]
