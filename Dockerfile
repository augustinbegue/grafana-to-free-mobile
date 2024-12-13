# Use the official Bun image as a base
FROM oven/bun:alpine

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb (if exists)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables with defaults (can be overridden)
ENV FREE_MOBILE_USER_ID=""
ENV FREE_MOBILE_PASS=""
ENV PORT=3000

# Run the application
CMD ["bun", "run", "index.ts"]
