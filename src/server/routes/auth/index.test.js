import { describe, expect, test, vi } from 'vitest'

const { createHubAuthPlugin, configGet } = vi.hoisted(() => ({
  createHubAuthPlugin: vi.fn(async () => ({
    plugin: { name: 'auth', register: () => undefined }
  })),
  configGet: vi.fn()
}))

vi.mock('@defra/lis-hubs-infra-access/auth', async () => {
  const actual = await vi.importActual('@defra/lis-hubs-infra-access/auth')

  return {
    ...actual,
    createHubAuthPlugin
  }
})

vi.mock('#config/config.js', () => ({
  config: {
    get: configGet
  }
}))

function createConfigValueMap() {
  return {
    'auth.primaryProvider': 'entra',
    'auth.hubOrigin': 'https://back-office.example',
    'auth.providers.entra.discoveryUrl':
      'https://identity.example/.well-known/openid-configuration',
    'auth.providers.entra.clientId': 'hub-client',
    'auth.providers.entra.clientSecret': 'secret',
    'auth.providers.entra.redirectPath': '/sso',
    'auth.providers.entra.serviceId': 'livestock-hub',
    'auth.hubJwt.cookieName': 'livestock_hub_jwt',
    'auth.hubJwt.secret': 'test-hub-secret-please-change-1234567890',
    'auth.hubJwt.issuer': 'http://localhost:3102',
    'auth.hubJwt.audience': 'livestock-spokes',
    'auth.hubJwt.ttlSeconds': 14400,
    'session.cookie.secure': false
  }
}

describe('#backOfficeAuthRoutes', () => {
  test('builds the hub auth plugin from the configured primary provider', async () => {
    // Arrange
    const configValues = createConfigValueMap()
    configGet.mockImplementation((path) => configValues[path])

    // Act
    let error
    try {
      await import('./index.js')
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).not.toBeDefined()
    const options = createHubAuthPlugin.mock.calls[0][0]
    expect(options.provider).toEqual({
      discoveryUrl: 'https://identity.example/.well-known/openid-configuration',
      clientId: 'hub-client',
      clientSecret: 'secret',
      redirectPath: '/sso',
      serviceId: 'livestock-hub'
    })
    expect(options.hubOrigin).toBe('https://back-office.example')
    expect(options.loginPath).toBe('/auth/login')
    expect(typeof options.mapUser).toBe('function')
    expect(typeof options.resolveAuthSession).toBe('function')
    expect(typeof options.getHubJwtCookieName).toBe('function')
    expect(typeof options.getCookieOptions).toBe('function')
    expect(typeof options.getHubJwtConfig).toBe('function')
  })

  test('translates Entra roles when resolving an auth session', async () => {
    // Arrange
    vi.resetModules()
    createHubAuthPlugin.mockClear()
    const configValues = createConfigValueMap()
    configGet.mockImplementation((path) => configValues[path])
    await import('./index.js')
    const { resolveAuthSession } = createHubAuthPlugin.mock.calls[0][0]

    // Act
    let result, error
    try {
      result = await resolveAuthSession({ user: { roles: ['bcms_user'] } })
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).not.toBeDefined()
    expect(result.roles).toEqual([
      'lis-role-reader',
      'lis-role-back-office',
      'lis-role-caseworker',
      'lis-role-cattle-write',
      'lis-role-cattle-register-write',
      'lis-role-sheep-write',
      'lis-role-sheep-register-write'
    ])
  })
})
