import {
  cphDetailsController,
  cphSearchController,
  userDetailsController,
  userSearchController
} from './controller.js'

export const search = {
  plugin: {
    name: 'search',
    register(server) {
      server.route([
        { method: 'GET', path: '/cphs', ...cphSearchController },
        { method: 'GET', path: '/cphs/{id}', ...cphDetailsController },
        { method: 'GET', path: '/users', ...userSearchController },
        { method: 'GET', path: '/users/{id}', ...userDetailsController }
      ])
    }
  }
}
