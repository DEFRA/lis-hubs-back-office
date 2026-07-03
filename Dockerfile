ARG PARENT_VERSION=3.0.5-node24.14.1
ARG PORT=3102
ARG PORT_DEBUG=9229

FROM defradigital/node-development:${PARENT_VERSION} AS development
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node-development:${PARENT_VERSION}

ENV TZ="Europe/London"

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

# .npmrc is gitignored and written by .scripts/publish.sh; when present it points
# @livestock at the local Verdaccio so it is copied in for local builds. Absent in
# CI, so npm falls back to the default registry.
COPY --chown=node:node --chmod=755 package*.json .npmrc* ./
RUN npm install
COPY --chown=node:node --chmod=755 . .
RUN npm run build:frontend

CMD [ "npm", "run", "docker:dev" ]

FROM development AS production_build

ENV NODE_ENV=production

RUN npm run build:frontend

FROM defradigital/node:${PARENT_VERSION} AS production
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node:${PARENT_VERSION}

ENV TZ="Europe/London"

# Add curl to template.
# CDP PLATFORM HEALTHCHECK REQUIREMENT
USER root
RUN apk add --no-cache curl
USER node

COPY --from=production_build /home/node/package*.json ./
COPY --from=production_build /home/node/src ./src/
COPY --from=production_build /home/node/.public/ ./.public/

RUN npm ci --omit=dev

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD [ "node", "src" ]
