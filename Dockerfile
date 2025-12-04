FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript (optional, but good for checking errors)
# RUN npm run build 

# Expose the API port
EXPOSE 3100

# Run the server
CMD ["npx", "ts-node", "src/server.ts"]
