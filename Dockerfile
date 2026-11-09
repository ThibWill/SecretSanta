# --- Étape 1 : compilation du front ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Étape 2 : dépendances du back (avec outils de compilation au cas où
#     better-sqlite3 n'aurait pas de binaire précompilé pour l'architecture) ---
FROM node:22-bookworm-slim AS backend-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# --- Étape 3 : image finale ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/secret-santa.db \
    PARTICIPANTS_FILE=/app/backend/config/participants.json \
    STATIC_DIR=/app/frontend/dist
WORKDIR /app/backend
# --chown plutôt qu'un « chown -R » après coup : évite de dupliquer les couches.
RUN mkdir -p /data && chown node:node /data /app/backend
COPY --chown=node:node --from=backend-deps /app/backend/node_modules ./node_modules
COPY --chown=node:node backend/ ./
COPY --chown=node:node --from=frontend /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
