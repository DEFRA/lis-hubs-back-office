/** @import { Server } from '@hapi/hapi' */
import { createServer } from '#server/server.js'
import { config } from '#config/config.js'

/**
 * @returns {Promise<Server>}
 */
export async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access the back office on http://localhost:${config.get('port')}`
  )

  return server
}
