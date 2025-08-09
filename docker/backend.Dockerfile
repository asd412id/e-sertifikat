FROM node:lts-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  NODE_ENV=production

# Install system dependencies for Puppeteer, Playwright (Chromium) and wkhtmltopdf
RUN apt-get update && apt-get install -y --no-install-recommends \
  wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils libxrender1 \
  libjpeg62-turbo libpng16-16 fontconfig libfreetype6 libxext6 libxi6 \
  wkhtmltopdf && rm -rf /var/lib/apt/lists/*

RUN npm install --omit=dev && npm cache clean --force

# Install Playwright browsers (Chromium only to save space)
RUN npx playwright install --with-deps chromium && \
  npx puppeteer browsers install chrome

RUN sh -c "cd ../frontend && npm install --omit=dev && npm run build && npm cache clean --force"