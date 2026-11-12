/** @import { Server } from '@hapi/hapi' */

import { holdingsController } from './controller.js'

export const holdings = {
  plugin: {
    name: 'holdings',
    /**
     * Registers the route on the server.
     * @param {Server} server - The Hapi server
     */
    register(server) {
      server.route({
        method: 'GET',
        path: '/holdings',
        ...holdingsController
      })
    }
  }
}
