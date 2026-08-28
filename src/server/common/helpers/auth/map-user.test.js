import { afterEach, describe, expect, test, vi } from 'vitest'

const { configGet, derivePseudonymousUserId, requestContext } = vi.hoisted(
  () => ({
    configGet: vi.fn((path) =>
      path === 'auth.userIdHashSecret' ? 'test-hash-secret' : undefined
    ),
    derivePseudonymousUserId: vi.fn(),
    requestContext: { set: vi.fn() }
  })
)

vi.mock('#config/config.js', () => ({ config: { get: configGet } }))
vi.mock('@defra/lis-hubs-infra-core', () => ({
  derivePseudonymousUserId,
  requestContext
}))

import { mapUser } from './map-user.js'

describe('mapUser()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('it maps DEFRA Identity name claims', () => {
    // Arrange
    const payload = { sub: 'user-1', firstName: 'Case', lastName: 'Worker' }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user).toEqual(
      expect.objectContaining({ firstName: 'Case', lastName: 'Worker' })
    )
  })

  test('it maps Entra ID name claims', () => {
    // Arrange
    const payload = {
      sub: 'user-1',
      given_name: 'Case',
      family_name: 'Worker'
    }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user).toEqual(
      expect.objectContaining({ firstName: 'Case', lastName: 'Worker' })
    )
  })

  test('it prefers DEFRA Identity name claims when both formats are present', () => {
    // Arrange
    const payload = {
      sub: 'user-1',
      firstName: 'DEFRA',
      lastName: 'Identity',
      given_name: 'Entra',
      family_name: 'ID'
    }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user).toEqual(
      expect.objectContaining({ firstName: 'DEFRA', lastName: 'Identity' })
    )
  })

  test('it defaults email, loa and amr when absent from the payload', () => {
    // Arrange
    const payload = { sub: 'user-1' }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user).toEqual(
      expect.objectContaining({ email: '', loa: '', amr: [], roles: [] })
    )
  })

  test('it passes through roles and amr arrays present on the payload', () => {
    // Arrange
    const payload = { sub: 'user-1', roles: ['lis-role-reader'], amr: ['pwd'] }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user).toEqual(
      expect.objectContaining({ roles: ['lis-role-reader'], amr: ['pwd'] })
    )
  })

  test('it falls back to the provider config service id when the payload has none', () => {
    // Arrange
    const payload = { sub: 'user-1' }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'provider-service-id' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user.serviceId).toBe('provider-service-id')
  })

  test('it derives user_id from the email using the configured hash secret and sets it in the request context', () => {
    // Arrange
    const payload = { sub: 'user-1', email: 'case.worker@example.com' }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }
    derivePseudonymousUserId.mockReturnValue('hashed-user-1')

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user.user_id).toBe('hashed-user-1')
    expect(derivePseudonymousUserId).toHaveBeenCalledWith(
      'case.worker@example.com',
      'test-hash-secret'
    )
    expect(requestContext.set).toHaveBeenCalledWith('user_id', 'hashed-user-1')
  })

  test('it does not set user_id in the request context when it cannot be derived', () => {
    // Arrange
    const payload = { sub: 'user-1' }
    const context = {
      providerId: 'test-provider',
      providerConfig: { serviceId: 'test-service' }
    }
    derivePseudonymousUserId.mockReturnValue(null)

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user.user_id).toBeNull()
    expect(requestContext.set).not.toHaveBeenCalled()
  })
})
