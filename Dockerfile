FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the project
COPY . .

# Build the React frontend
RUN npm run build

EXPOSE 3030

# Start the Node Express backend
CMD ["npm", "start"]