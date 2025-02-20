# FROM node:18-alpine

# WORKDIR /app

# COPY deep-research/. .
# COPY deep-research/package.json ./
# COPY deep-research/.env.local ./.env.local

# RUN npm install

# CMD ["npm", "run", "docker"]



# Use an official Node.js image as the base
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json for both projects
COPY deep-research/package.json deep-research/package-lock.json ./deep-research/
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install dependencies separately
RUN cd deep-research && npm install
RUN cd frontend && npm install

# Copy the entire project files
COPY . .

# Expose the necessary ports
EXPOSE 3000 3001

# Use a process manager to run both services
CMD ["sh", "-c", "cd deep-research && npm run api & cd /app/frontend && npm run start"]
