/** @import { Server } from '@hapi/hapi' */
import path from 'node:path'

import hapi from '@hapi/hapi'
import inert from '@hapi/inert'
import Scooter from '@hapi/scooter'
import {
  createProxyPlugin,
  logger,
  requestContext
} from '@defra/lis-hubs-infra-core'
import { catchAll } from '@defra/lis-infra-ui-services/errors'
import { createNunjucksConfig } from '@defra/lis-infra-ui-services/nunjucks/plugin'
import { createBasePathHelpersForConfig } from '@defra/lis-infra-ui-services/base-path'
import { createSessionCachePluginForConfig } from '@defra/lis-infra-ui-services/session-cache'
import { getCacheEngine } from '@defra/lis-infra-ui-services/session-cache/cache-engine'
import { setupProxy } from '@defra/lis-infra-ui-services/proxy/setup-proxy'

import { config } from '#config/config.js'
import { contentSecurityPolicy } from '#server/plugins/content-security-policy.js'
import { serveStaticFiles } from '#server/plugins/serve-static-files.js'
import { auth } from '#server/routes/auth/index.js'
import { health } from '#server/routes/health/index.js'
import { home } from '#server/routes/home/index.js'
import { search } from '#server/routes/search/index.js'

logger.level = config.get('log.level')
logger.enabled = config.get('log.enabled')
logger.format =
  config.get('log.format') === 'pino-pretty'
    ? 'pretty-print'
    : config.get('log.format')
logger.serviceName = 'lis-hubs-back-office'
logger.serviceVersion = config.get('serviceVersion')
const requestLogger = logger.hapiPlugin
const sessionCache = createSessionCachePluginForConfig(config)
const proxy = createProxyPlugin({
  hubId: 'back-office',
  environment: config.get('environment')
})
const { getRequestBasePath } = createBasePathHelpersForConfig({
  assetPath: config.get('assetPath')
})
const nunjucksConfig = createNunjucksConfig({
  config,
  logger,
  getRequestBasePath
})

/**
 * @returns {Promise<Server>}
 */
export async function createServer() {
  setupProxy({
    proxyUrl: config.get('httpProxy'),
    logger
  })

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
    {
      plugin: requestContext.plugin,
      options: { originService: 'back-office' }
    },
    inert,
    Scooter,
    requestLogger,
    sessionCache,
    nunjucksConfig,
    contentSecurityPolicy,
    serveStaticFiles,
    auth.plugin,
    health.plugin,
    home.plugin,
    search.plugin,
    proxy.plugin
  ])

  server.ext('onPreResponse', catchAll)

  return server
}
