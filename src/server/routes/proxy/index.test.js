import { beforeEach, describe, expect, test, vi } from 'vitest'

import { config } from '#config/config.js'
import { getModulesForHub } from '@defra/lis-hubs-infra-registry'
import { proxy } from './index.js'

vi.mock('@defra/lis-hubs-infra-registry')

const mocks = {
  configGet: vi.spyOn(config, 'get'),
  getModulesForHub: vi.mocked(getModulesForHub)
}

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getModulesForHub.mockReturnValue([
      { id: 'cattle-home', path: '/cattle/home', port: 3222 }
    ])
  })

  test.each([
    // Local proxying intentionally uses HTTP because the services run locally.
    ['local', 'http://localhost:3222'],
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    ['docker_compose', 'http://cattle-home:3222'],
    ['test', 'https://lis-cattle-home.test.cdp-int.defra.cloud:3222'],
    ['prod', 'https://lis-cattle-home.prod.cdp-int.defra.cloud:3222']
  ])('it registers the %s proxy target', (environment, expectedBaseUri) => {
    // Arrange
    mocks.configGet.mockReturnValue(environment)
    const server = { route: vi.fn() }

    // Act
    proxy.plugin.register(server)

    // Assert
    expect(mocks.getModulesForHub).toHaveBeenCalledWith('back-office')
    const route = server.route.mock.calls[0][0]
    expect(route).toMatchObject({
      method: '*',
      path: '/cattle/home/{path*}'
    })
    expect(
      route.handler.proxy.mapUri({
        params: { path: 'summary-data' },
        headers: { cookie: 'session=abc' }
      })
    ).toEqual({
      uri: `${expectedBaseUri}/summary-data`,
      headers: {
        'x-forwarded-prefix': '/cattle/home',
        cookie: 'session=abc'
      }
    })
    expect(route.handler.proxy.mapUri({ params: {}, headers: {} })).toEqual({
      uri: expectedBaseUri,
      headers: { 'x-forwarded-prefix': '/cattle/home' }
    })
  })

  test('it rejects an unsupported environment', () => {
    // Arrange
    mocks.configGet.mockReturnValue('unknown')

    // Act
    let error
    try {
      proxy.plugin.register({ route: vi.fn() })
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeDefined()
    expect(error.message).toBe('Unhandled environment: unknown')
  })
})
