FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/wishlist.db

# Expose port
EXPOSE 3001

# Initialize database and start application
CMD ["sh", "-c", "node scripts/init-db.js && node server.js"]
