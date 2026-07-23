import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('#backOfficeServer', () => {
  const originalLogFormat = process.env.LOG_FORMAT
  let createServer
  let server

  beforeAll(async () => {
    process.env.LOG_FORMAT = 'pino-pretty'
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

  test('Should render the back-office welcome page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('Livestock back office')
  })

  test('Should render submitted registration review actions', async () => {
    const result = await server.render('home/dashboard', {
      pageTitle: 'Dashboard',
      authenticatedUser: { firstName: 'Caseworker' },
      greeting: 'Good morning',
      actionsToComplete: [
        {
          title: 'Review cattle registration REG-MNBX1K8F',
          description:
            'Submitted for CPH 10/081/1234 · 2 animals · 11 July 2026',
          url: '/cattle/register/10/081/1234/bundles/REG-MNBX1K8F'
        }
      ],
      logoutUrl: '/auth/logout'
    })

    expect(result).toContain('Actions to complete')
    expect(result).toContain('Review cattle registration REG-MNBX1K8F')
    expect(result).toContain('Submitted for CPH 10/081/1234')
    expect(result).toContain(
      'href="/cattle/register/10/081/1234/bundles/REG-MNBX1K8F"'
    )
  })

  test.each([
    ['search/cphs', 'Browse CPHs'],
    ['search/users', 'Find a user by email']
  ])('Should render the %s search page', async (view, heading) => {
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
