import { HUB_AUTH_STRATEGY } from '@defra/lis-hubs-infra-access/authentication'
import { PERMISSIONS } from '@defra/lis-hubs-infra-access/authorization'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

function hubAuth(permissions) {
  return {
    strategy: HUB_AUTH_STRATEGY,
    credentials: {
      user: {
        sub: 'user-1',
        statements: [{ role: 'test', cphs: '*', permissions }]
      },
      authorizedSpecies: []
    }
  }
}

describe('#backOfficeServer', () => {
  const originalLogFormat = process.env.LOG_FORMAT
  let createServer
  let server

  beforeAll(async () => {
    process.env.LOG_FORMAT = 'pretty'
    ;({ createServer } = await import('./server.js'))
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }

    if (originalLogFormat === undefined) {
      delete process.env.LOG_FORMAT
    } else {
      process.env.LOG_FORMAT = originalLogFormat
    }
  })

  test('Should return a no-content favicon route for the back-office shell', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/favicon.ico'
    })

    expect(response.statusCode).toBe(204)
  })

  test('Should apply a content security policy header to back-office responses', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'self'"
    )
  })

  test('Should redirect unauthenticated requests to the root route to login', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/auth/login?returnUrl=%2F')
  })

  test('Should redirect unauthenticated search requests to login with the full return URL', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Oakfield'
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      '/auth/login?returnUrl=%2Fholdings%3Fsearch%3DOakfield'
    )
  })

  test('Should redirect signed-in users from the root route to holdings search', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/holdings')
  })

  test('Should deny signed-in users without back-office access', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([])
    })

    expect(response.statusCode).toBe(403)
  })

  test('Should allow signed-in users with back-office access', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
  })

  test('Should fall back to the first page for an invalid page number', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Lavendon&page=abc',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('<strong>11</strong> holdings match')
    expect(response.payload).toContain('href="/cattle/holdings/22/002/0002"')
    expect(response.payload).not.toContain('Page 1 of')
  })

  test.each([
    ['Oakfield', '<strong>1</strong> holding matches ‘Oakfield’'],
    ['Lavendon', '<strong>11</strong> holdings match ‘Lavendon’'],
    ['<b>x</b>', '<strong>0</strong> holdings match ‘&lt;b&gt;x&lt;/b&gt;’']
  ])('Should render the match count for %s', async (search, expected) => {
    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${encodeURIComponent(search)}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain(expected)
    expect(response.payload.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  test('Should accept a search longer than 100 characters', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${'a'.repeat(150)}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
  })

  test('Should render results as a table with a row header link and no instructions', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Oakfield',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain('Holdings search results')
    expect(response.payload).toContain('href="/cattle/holdings/22/001/0001"')
    expect(response.payload).not.toContain('You can search using:')
  })

  test('Should render the search instructions before a search', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain('You can search using:')
    expect(response.payload).not.toContain('Clear search')
  })

  test('Should render the search/users search page', async () => {
    const view = 'search/users'
    const heading = 'Find a user by email'
    const result = await server.render(view, {
      pageTitle: heading,
      heading,
      searchBy: 'browse',
      searchType: { fields: [] },
      filters: {},
      applied: true,
      results: [],
      total: 0,
      pagination: null
    })

    expect(result).toContain(heading)
    expect(result).toContain('method="get"')
  })
})
