# Use an official Node.js runtime as a parent image
# Choose a Node version compatible with your app (e.g., 18, 20)
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install Ghostscript and other necessary build tools
# Clean up apt cache to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends ghostscript wget curl && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
# Use --production if you don't need devDependencies in the final image
RUN npm install --production

# Bundle app source
COPY . .

# Create necessary directories (if your app doesn't create them robustly)
# These will be within the container's ephemeral filesystem
RUN mkdir -p uploads compressed_pdfs

# Make port 10000 available to the world outside this container
# Render will automatically set the PORT environment variable,
# your app should use process.env.PORT
EXPOSE 10000

# Define environment variable (Render will override PORT)
ENV NODE_ENV=production
# ENV PORT=10000 # Not strictly necessary as Render sets it

# Command to run the application
# Ensure your app.js listens on process.env.PORT || 3000 (or similar)
CMD ["node", "app.js"]