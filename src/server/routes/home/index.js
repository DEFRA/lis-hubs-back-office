/** @import { Server } from '@hapi/hapi' */

export const home = {
  plugin: {
    name: 'home',
    /**
     * Registers the route on the server.
     * @param {Server} server - The Hapi server
     */
    register(server) {
      server.route({
        method: 'GET',
        path: '/',
        handler: (_request, h) => h.redirect('/holdings')
      })
    }
  }
}
