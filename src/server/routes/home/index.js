export const home = {
  plugin: {
    name: 'home',
    register(server) {
      server.route({
        method: 'GET',
        path: '/',
        handler: (_request, h) => h.redirect('/holdings')
      })
    }
  }
}
