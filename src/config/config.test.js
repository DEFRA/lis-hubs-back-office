import { afterEach, describe, expect, test, vi } from 'vitest'
describe('session cache ttl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('accepts an ISO 8601 duration from the environment', async () => {
    // Arrange
    vi.stubEnv('SESSION_CACHE_TTL', 'PT4H')

    // Act
    const { config } = await import('./config.js?ttl=iso')

    // Assert
    expect(config.get('session.cache.ttl')).toBe(14400000)
  })

  test('rejects a ttl over 7 days', async () => {
    // Arrange
    vi.stubEnv('SESSION_CACHE_TTL', 'P8D')

    // Act
    let error
    try {
      await import('./config.js?ttl=over')
    } catch (e) {
      error = e
    }

    // Assert
    expect(error.message).toContain(
      'session.cache.ttl: must be no more than P7D'
    )
  })
})

describe('oidc client secret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test.each([
    ['not set', undefined],
    ['empty', '']
  ])('fails to load when OIDC_CLIENT_SECRET is %s', async (_, value) => {
    // Arrange
    vi.stubEnv('OIDC_CLIENT_SECRET', value)

    // Act
    let error
    try {
      await import('./config.js')
    } catch (e) {
      error = e
    }

    // Assert
    expect(error.message).toContain('clientSecret: must be set')
  })
})

describe('environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('accepts ext-test', async () => {
    // Arrange
    vi.stubEnv('ENVIRONMENT', 'ext-test')

    // Act
    const { config } = await import('./config.js?env=ext-test')

    // Assert
    expect(config.get('environment')).toBe('ext-test')
  })

  test('rejects an environment the platform does not have', async () => {
    // Arrange
    vi.stubEnv('ENVIRONMENT', 'staging')

    // Act
    let error
    try {
      await import('./config.js?env=staging')
    } catch (e) {
      error = e
    }

    // Assert
    expect(error.message).toContain('environment: must be one of')
  })
})
