import hapi from '@hapi/hapi'
import { verifyHubJwt } from '@livestock/ui-services/auth'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant,
  configGet,
  fetchUserProfile,
  getHubAuthSession,
  setHubAuthSession
} = vi.hoisted(() => ({
  buildAuthorizationUrl: vi.fn(),
  buildLogoutUrl: vi.fn(),
  completeAuthorizationCodeGrant: vi.fn(),
  configGet: vi.fn(),
  fetchUserProfile: vi.fn(),
  getHubAuthSession: vi.fn(),
  setHubAuthSession: vi.fn()
}))

const { clearHubAuthSession } = vi.hoisted(() => ({
  clearHubAuthSession: vi.fn()
}))

vi.mock('@livestock/ui-services', async () => {
  const actual = await vi.importActual('@livestock/ui-services')

  return {
    ...actual,
    createProfileService: vi.fn(() => fetchUserProfile)
  }
})

vi.mock('#config/config.js', () => ({
  config: {
    get: configGet
  }
}))

vi.mock('@livestock/infra-core/auth/session', () => ({
  clearHubAuthSession,
  getHubAuthSession,
  setHubAuthSession
}))

vi.mock('#server/common/helpers/auth/oidc.js', () => ({
  buildAuthorizationUrl,
  buildLogoutUrl,
  completeAuthorizationCodeGrant
}))

import { auth } from './index.js'

const jwtConfig = {
  secret: 'test-hub-secret-please-change-1234567890',
  issuer: 'http://localhost:3102',
  audience: 'livestock-spokes'
}

function createConfigValueMap() {
  return {
    'auth.primaryProvider': 'sso',
    'auth.fallbackProvider': 'defra-ci',
    'auth.hubJwt.cookieName': 'livestock_hub_jwt',
    'auth.hubJwt.secret': jwtConfig.secret,
    'auth.hubJwt.issuer': jwtConfig.issuer,
    'auth.hubJwt.audience': jwtConfig.audience,
    'auth.hubJwt.ttlSeconds': 14400,
    'session.cookie.secure': false,
    'profileService.url': 'http://localhost:4000/api/profile',
    'profileService.apiKey': '',
    'profileService.apiKeyHeader': 'x-api-key'
  }
}

function extractCookieValue(setCookieHeader, cookieName) {
  const cookieHeader = (
    Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
  ).find((value) => value.startsWith(`${cookieName}=`))

  if (!cookieHeader) {
    throw new Error(`Cookie ${cookieName} was not found in response`)
  }

  return decodeURIComponent(
    cookieHeader.split(';')[0].slice(cookieName.length + 1)
  )
}

async function createTestServer() {
  const server = hapi.server({
    state: {
      strictHeader: false
    }
  })

  await server.register(auth.plugin)

  return server
}

describe('#backOfficeAuthRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const configValues = createConfigValueMap()
    configGet.mockImplementation((path) => configValues[path])
  })

  test('Should use the primary provider for the default login route', async () => {
    buildAuthorizationUrl.mockResolvedValue('https://sso.example.test/login')

    const server = await createTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/auth/login?returnUrl=/dashboard'
    })

    await server.stop({ timeout: 0 })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://sso.example.test/login')
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.any(Object),
      'sso'
    )
  })

  test('Should use the fallback provider for the fallback login route', async () => {
    buildAuthorizationUrl.mockResolvedValue(
      'https://defra-ci.example.test/login'
    )

    const server = await createTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/auth/login/fallback?returnUrl=/dashboard'
    })

    await server.stop({ timeout: 0 })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      'https://defra-ci.example.test/login'
    )
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.any(Object),
      'defra-ci'
    )
  })

  test('Should return a service unavailable response when the provider login configuration is invalid', async () => {
    buildAuthorizationUrl.mockRejectedValue(
      new Error('OIDC discovery URL is not configured for provider sso')
    )

    const server = await createTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/auth/login?returnUrl=/dashboard'
    })

    await server.stop({ timeout: 0 })

    expect(response.statusCode).toBe(503)
    expect(response.result).toContain(
      'Authentication is not available. Check the hub OIDC configuration.'
    )
  })

  test('Should enrich the callback session with profile permissions before minting the hub JWT', async () => {
    const user = {
      sub: 'test-user',
      email: 'test.user@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: ['caseworker'],
      serviceId: 'test-service',
      loa: 'substantial',
      amr: ['pwd'],
      authProvider: 'sso'
    }
    const authSession = {
      ...user,
      idToken: 'id-token',
      authenticatedAt: '2026-05-15T10:00:00.000Z'
    }
    const profile = {
      roles: ['lis-role-back-office-caseworker'],
      permissions: ['lis-perm-back-office', 'lis-perm-cattle-write'],
      holdings: ['holding-1']
    }

    completeAuthorizationCodeGrant.mockResolvedValue({
      user,
      authSession,
      accessToken: 'access-token',
      returnUrl: '/dashboard'
    })
    fetchUserProfile.mockResolvedValue(profile)

    const server = await createTestServer()
    const response = await server.inject({
      method: 'GET',
      url: '/sso'
    })

    await server.stop({ timeout: 0 })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/dashboard')
    expect(fetchUserProfile).toHaveBeenCalledWith(user, 'access-token')
    expect(setHubAuthSession).toHaveBeenCalledWith(expect.any(Object), {
      ...authSession,
      ...profile
    })

    const token = extractCookieValue(
      response.headers['set-cookie'],
      'livestock_hub_jwt'
    )
    const payload = await verifyHubJwt(token, jwtConfig)

    expect(payload.sub).toBe(user.sub)
    expect(payload.permissions).toEqual(profile.permissions)
    expect(payload.roles).toEqual(profile.roles)
  })
})
