FROM node:20-slim

# Install system dependencies including python3, pip, venv, and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# Install Deno (for signature decryption)
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

COPY . .

# Setup Python environment inside the container
RUN python3 -m venv music-service/.venv && \
    . music-service/.venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r music-service/requirements.txt

# Expose the web shop port
EXPOSE 3000

CMD [ "npm", "start" ]
