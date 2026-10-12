import { holdingsController } from './controller.js'

export const holdings = {
  plugin: {
    name: 'holdings',
    register(server) {
      server.route({
        method: 'GET',
        path: '/holdings',
        ...holdingsController
      })
    }
  }
}
