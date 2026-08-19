import { getModulesForHub } from '@defra/lis-hubs-infra-registry'

import { config } from '#config/config.js'

export const proxy = {
  plugin: {
    name: 'proxy',
    register(server) {
      for (const { id: moduleName, path, port } of getModulesForHub(
        'back-office'
      )) {
        const environment = config.get('environment')
        let host, protocol
        switch (environment) {
          case 'local':
            host = 'localhost'
            protocol = 'http'
            break
          case 'docker_compose':
            host = moduleName
            protocol = 'http'
            break
          case 'dev':
          case 'test':
          case 'perf-test':
          case 'prod':
            host = `lis-${moduleName}.${environment}.cdp-int.defra.cloud`
            protocol = 'https'
            break
          default:
            throw new Error(`Unhandled environment: ${environment}`)
        }

        const baseUri = `${protocol}://${host}:${port}`

        server.route({
          method: '*',
          path: `${path}/{path*}`,
          handler: {
            proxy: {
              passThrough: true,
              xforward: true,
              mapUri(request) {
                const subPath = request.params.path ?? ''
                const uri = subPath ? `${baseUri}/${subPath}` : baseUri

                return {
                  uri,
                  headers: {
                    'x-forwarded-prefix': path,
                    ...(request.headers.cookie && {
                      cookie: request.headers.cookie
                    })
                  }
                }
              }
            }
          }
        })
      }
    }
  }
}
