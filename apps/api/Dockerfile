FROM node:22-alpine

WORKDIR /app

# Install dependencies required for node-gyp / native modules if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "dev"]
