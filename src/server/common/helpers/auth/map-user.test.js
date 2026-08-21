import { describe, expect, test } from 'vitest'

import { mapUser } from './map-user.js'

describe('mapUser()', () => {
  test('it maps DEFRA Identity name claims', () => {
    // Arrange
    const payload = { sub: 'user-1', firstName: 'Case', lastName: 'Worker' }
    const context = {
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
      providerConfig: { serviceId: 'provider-service-id' }
    }

    // Act
    const user = mapUser(payload, context)

    // Assert
    expect(user.serviceId).toBe('provider-service-id')
  })
})
