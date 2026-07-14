import { createServer } from '#server/server.js'
import { config } from '#config/config.js'
import { getLoggerForConfig } from '@livestock/ui-services/logging'

export async function startServer() {
  const server = await createServer()
  const logger = getLoggerForConfig(config)

  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access the back office on http://localhost:${config.get('port')}`
  )

  return server
}
