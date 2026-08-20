import { beforeEach, describe, expect, test, vi } from 'vitest'

import { config } from '#config/config.js'
import { getProviderConfig } from './get-provider-config.js'

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

describe('getProviderConfig()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('it reads the named provider config', () => {
    // Arrange
    const providerId = 'entra'
    const configValues = {
      'auth.providers.entra.discoveryUrl': 'https://entra.example.test',
      'auth.providers.entra.clientId': 'entra-client-id',
      'auth.providers.entra.clientSecret': 'entra-client-secret',
      'auth.providers.entra.redirectPath': '/sso',
      'auth.providers.entra.serviceId': 'entra-service-id'
    }
    mocks.configGet.mockImplementation((key) => configValues[key])

    // Act
    const providerConfig = getProviderConfig(providerId)

    // Assert
    expect(providerConfig).toEqual({
      discoveryUrl: 'https://entra.example.test',
      clientId: 'entra-client-id',
      clientSecret: 'entra-client-secret',
      redirectPath: '/sso',
      serviceId: 'entra-service-id'
    })
  })

  test('it throws when no provider id is given', () => {
    // Arrange
    const providerId = undefined

    // Act
    let error
    try {
      getProviderConfig(providerId)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeDefined()
    expect(error.message).toBe('Authentication provider id is required')
  })
})
