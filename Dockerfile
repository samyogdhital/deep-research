# Use an official Node.js image as the base
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json for both projects
COPY deep-research/package*.json ./deep-research/
COPY frontend/package*.json ./frontend/

# Install dependencies separately
RUN cd deep-research && npm install
RUN cd frontend && npm install

# Copy the entire project files
COPY . .

# Build both projects
# RUN cd deep-research && npm run build
RUN cd frontend && npm run build

# Expose the necessary ports
EXPOSE 3000 3001

# Start both projects after building
CMD ["sh", "-c", "cd deep-research && npm run api & cd /app/frontend && npm run start"]
