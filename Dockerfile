# Use official Node.js LTS Debian-based image instead of alpine
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of your app files
COPY . .

# Build your NestJS app
RUN npm run build

# Expose the port your app listens on
EXPOSE 3000

# Start the app
CMD ["node", "dist/src/main.js"]
