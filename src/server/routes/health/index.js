/** @import { Server } from '@hapi/hapi' */

import { healthController } from './controller.js'

export const health = {
  plugin: {
    name: 'health',
    /**
     * Registers the route on the server.
     * @param {Server} server - The Hapi server
     */
    register(server) {
      server.route({
        method: 'GET',
        path: '/health',
        options: { auth: false },
        ...healthController
      })
    }
  }
}
