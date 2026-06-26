import path from 'node:path'

import hapi from '@hapi/hapi'
import inert from '@hapi/inert'
import Scooter from '@hapi/scooter'
import { catchAll } from '@livestock/infrastructure/errors'
import { getLoggerForConfig } from '@livestock/infrastructure/logging'
import { getRequestLoggerPluginForConfig } from '@livestock/infrastructure/logging'
import { createNunjucksConfig } from '@livestock/infrastructure/nunjucks/plugin'
import { createBasePathHelpersForConfig } from '@livestock/infrastructure/base-path'
import { createSessionCachePluginForConfig } from '@livestock/infrastructure/session-cache'
import { getCacheEngine } from '@livestock/infrastructure/session-cache/cache-engine'

import { config } from '#config/config.js'
import { contentSecurityPolicy } from '#server/plugins/content-security-policy.js'
import { serveStaticFiles } from '#server/plugins/serve-static-files.js'
import { auth } from '#server/routes/auth/index.js'
import { health } from '#server/routes/health/index.js'
import { home } from '#server/routes/home/index.js'

const logger = getLoggerForConfig(config)
const requestLogger = getRequestLoggerPluginForConfig(config)
const sessionCache = createSessionCachePluginForConfig(config)
const { getRequestBasePath } = createBasePathHelpersForConfig(config)
const nunjucksConfig = createNunjucksConfig({
  config,
  logger,
  getRequestBasePath
})

export async function createServer() {
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      }
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine({
          engine: config.get('session.cache.engine'),
          config,
          logger
        })
      }
    ],
    state: {
      strictHeader: false
    }
  })

  await server.register([
    inert,
    Scooter,
    requestLogger,
    sessionCache,
    nunjucksConfig,
    contentSecurityPolicy,
    serveStaticFiles,
    auth.plugin,
    health.plugin,
    home.plugin
  ])

  server.ext('onPreResponse', catchAll)

  return server
}
