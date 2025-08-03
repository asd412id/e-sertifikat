FROM node:lts-slim

# Update package list and install dependencies for puppeteer
RUN apt-get update && \
  apt-get install -y wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils chromium --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*