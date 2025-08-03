FROM node:lts-slim

# Install dependencies for Puppeteer/Chrome
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils && \
  rm -rf /var/lib/apt/lists/*

# Install Chrome for Puppeteer
RUN npx puppeteer browsers install chrome