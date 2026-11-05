import { HUB_AUTH_STRATEGY } from '@defra/lis-hubs-infra-access/authentication'
import { PERMISSIONS } from '@defra/lis-hubs-infra-access/authorization'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  buildLogoutUrl,
  getLogoutOrigins
} from '#server/common/helpers/auth/oidc.js'
import { createServer } from '#server/server.js'

vi.mock('#server/common/helpers/auth/oidc.js')

const mocks = {
  buildLogoutUrl: vi.mocked(buildLogoutUrl),
  getLogoutOrigins: vi.mocked(getLogoutOrigins)
}

const signedInAuth = {
  strategy: HUB_AUTH_STRATEGY,
  credentials: {
    user: { sub: 'user-1', statements: [] },
    authorizedSpecies: []
  }
}

const authorisedAuth = {
  strategy: HUB_AUTH_STRATEGY,
  credentials: {
    user: {
      sub: 'user-1',
      statements: [
        { role: 'test', cphs: '*', permissions: [PERMISSIONS.backOffice] }
      ]
    },
    authorizedSpecies: []
  }
}

// A signed-in page issues the session's CSRF token; the session cookie
// carries the session on, and the sign-out confirmation page renders the token.
async function signIn(
  server,
  { url = '/auth/not-authorised', auth = signedInAuth } = {}
) {
  const response = await server.inject({ method: 'GET', url, auth })
  const cookie = [response.headers['set-cookie']]
    .flat()
    .map((setCookie) => setCookie.split(';')[0])
    .join('; ')
  const confirmation = await server.inject({
    method: 'GET',
    url: '/signout',
    headers: { cookie }
  })
  const [, csrfToken] = /name="_csrf" value="([\w-]+)"/.exec(
    confirmation.payload
  )

  return { cookie, csrfToken }
}

function toRequestPath(routePath) {
  return routePath.replace('{cph*3}', '12/345/6789').replace('{path*}', 'x')
}

describe('#backOfficeServer CSRF protection', () => {
  let server

  beforeAll(async () => {
    mocks.buildLogoutUrl.mockResolvedValue('https://identity.example/logout')
    mocks.getLogoutOrigins.mockResolvedValue([
      'https://identity.example',
      'https://issuer.example'
    ])
    server = await createServer()
    await server.initialize()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should sign out on a same-origin POST carrying the session token, redirecting to the identity provider', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
      payload: { _csrf: csrfToken }
    })
    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://identity.example/logout')
    expect(mocks.buildLogoutUrl).toHaveBeenCalledTimes(1)
    expect(afterResponse.headers.location).toBe('/')
  })

  test('Should answer with the error page and still end the session when the logout URL cannot be built', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)
    mocks.buildLogoutUrl.mockRejectedValueOnce(new Error('discovery failed'))

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
      payload: { _csrf: csrfToken }
    })
    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(500)
    expect(afterResponse.headers.location).toBe('/')
  })

  test('Should send a sign-out POST without the token home without signing out', async () => {
    // Arrange
    const { cookie } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
      payload: {}
    })

    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(afterResponse.statusCode).toBe(200)
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
  })

  test('Should send a cross-site sign-out POST home without signing out, even with the token', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'cross-site' },
      payload: { _csrf: csrfToken }
    })

    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(afterResponse.statusCode).toBe(200)
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
  })

  test('Should send a sign-out POST with the wrong token home without signing out', async () => {
    // Arrange
    const { cookie } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
      payload: { _csrf: 'not-the-session-token' }
    })
    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
    expect(afterResponse.statusCode).toBe(200)
  })

  test('Should send a same-site sign-out POST home without signing out, even with the token', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { cookie, 'sec-fetch-site': 'same-site' },
      payload: { _csrf: csrfToken }
    })
    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
    expect(afterResponse.statusCode).toBe(200)
  })

  test('Should sign out on a POST without sec-fetch-site when the origin matches the host', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: {
        cookie,
        host: 'back-office.test',
        origin: 'https://back-office.test'
      },
      payload: { _csrf: csrfToken }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://identity.example/logout')
    expect(mocks.buildLogoutUrl).toHaveBeenCalledTimes(1)
  })

  test('Should send a POST without sec-fetch-site from another origin home without signing out', async () => {
    // Arrange
    const { cookie, csrfToken } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: {
        cookie,
        host: 'back-office.test',
        origin: 'https://evil.example'
      },
      payload: { _csrf: csrfToken }
    })
    const afterResponse = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
    expect(afterResponse.statusCode).toBe(200)
  })

  test('Should send an expired session signing out home', async () => {
    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/signout',
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: { _csrf: 'token-from-an-expired-session' }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
  })

  test('Should ask a signed-in user to confirm on a GET to /signout, allowing the sign-out origins in the form-action of that page only', async () => {
    // Arrange
    const { cookie } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })
    const otherResponse = await server.inject({
      method: 'GET',
      url: '/auth/not-authorised',
      headers: { cookie }
    })
    const policy = response.headers['content-security-policy']
    const otherPolicy = otherResponse.headers['content-security-policy']

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      '<h1 class="govuk-heading-l">Are you sure you want to sign out?</h1>'
    )
    expect(response.payload).toMatch(
      /<form action="\/signout" method="post" novalidate>\s*<input type="hidden" name="_csrf" value="[\w-]+">/
    )
    expect(response.payload).toContain(
      '<a class="govuk-link" href="/">Cancel</a>'
    )
    expect(policy).toContain(
      "form-action 'self' https://identity.example https://issuer.example;"
    )
    expect(otherPolicy).toContain("form-action 'self';")
    expect(
      policy.replace(' https://identity.example https://issuer.example', '')
    ).toBe(otherPolicy)
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
  })

  test('Should still render the confirmation page, without widening form-action, when discovery fails', async () => {
    // Arrange
    const { cookie } = await signIn(server)
    mocks.getLogoutOrigins.mockRejectedValueOnce(new Error('discovery failed'))

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/signout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      '<h1 class="govuk-heading-l">Are you sure you want to sign out?</h1>'
    )
    expect(response.headers['content-security-policy']).toContain(
      "form-action 'self';"
    )
  })

  test('Should send a signed-out GET to /signout home', async () => {
    // Act
    const response = await server.inject({ method: 'GET', url: '/signout' })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/')
  })

  test('Should redirect the old GET /auth/logout to /signout', async () => {
    // Arrange
    const { cookie } = await signIn(server)

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/auth/logout',
      headers: { cookie }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/signout')
    expect(mocks.buildLogoutUrl).not.toHaveBeenCalled()
  })

  test('Should record a same-origin cookie choice without a token', async () => {
    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/cookies',
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: { analytics: 'no' }
    })
    const setCookies = [response.headers['set-cookie']].flat().filter(Boolean)

    // Assert
    expect(response.statusCode).toBe(302)
    expect(
      setCookies.some((setCookie) => setCookie.startsWith('cookies_policy='))
    ).toBe(true)
  })

  test('Should not record a cross-site cookie choice', async () => {
    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/cookies',
      headers: { 'sec-fetch-site': 'cross-site' },
      payload: { analytics: 'no' }
    })
    const setCookies = [response.headers['set-cookie']].flat().filter(Boolean)

    // Assert
    expect(
      setCookies.some((setCookie) => setCookie.startsWith('cookies_policy='))
    ).toBe(false)
  })

  test('Should leave the token check on proxied spoke routes to the spoke', () => {
    // Act
    const proxyRoutes = server.table().filter(({ method }) => method === '*')

    // Assert
    expect(proxyRoutes.length).toBeGreaterThan(0)
    for (const route of proxyRoutes) {
      expect(route.settings.plugins['lis-csrf']).toEqual({ token: false })
    }
  })

  test('Should refuse a cross-site POST to a proxied spoke route', async () => {
    // Arrange
    const [proxyRoute] = server.table().filter(({ method }) => method === '*')

    // Act
    const response = await server.inject({
      method: 'POST',
      url: toRequestPath(proxyRoute.path),
      headers: { 'sec-fetch-site': 'cross-site' },
      auth: authorisedAuth,
      payload: { name: 'value' }
    })

    // Assert
    expect(response.statusCode).toBe(403)
  })
})
