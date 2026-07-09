/** @import { Server } from '@hapi/hapi' */
import path from 'node:path'

import hapi from '@hapi/hapi'
import inert from '@hapi/inert'
import Scooter from '@hapi/scooter'
import { catchAll } from '@livestock/ui-services/errors'
import { getLoggerForConfig } from '@livestock/ui-services/logging'
import { getRequestLoggerPluginForConfig } from '@livestock/ui-services/logging'
import { createNunjucksConfig } from '@livestock/ui-services/nunjucks/plugin'
import { createBasePathHelpersForConfig } from '@livestock/ui-services/base-path'
import { createSessionCachePluginForConfig } from '@livestock/ui-services/session-cache'
import { getCacheEngine } from '@livestock/ui-services/session-cache/cache-engine'

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

/**
 * @returns {Promise<Server>}
 */
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
