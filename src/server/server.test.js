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

import { config } from '#config/config.js'
import { cattleHomeBe4FeClient } from '#server/common/helpers/cattle-home-be4fe-client.js'

vi.mock('#server/common/helpers/cattle-home-be4fe-client.js')

const mocks = {
  searchHoldings: vi.mocked(cattleHomeBe4FeClient.searchHoldings)
}

function holdingsPage(cphs, totalCount = cphs.length) {
  return {
    count: cphs.length,
    total_count: totalCount,
    items: cphs.map((cph) => ({
      cph,
      name: null,
      holding_type: null,
      address: ['Oakfield Farm', 'Lavendon', 'MK1 1AB'],
      keeper_name: null
    })),
    page: 1,
    page_size: 25,
    total_pages: Math.ceil(totalCount / 25),
    has_next_page: totalCount > 25,
    has_previous_page: false
  }
}

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
    mocks.searchHoldings.mockResolvedValue(holdingsPage([]))
    process.env.LOG_FORMAT = 'pretty'
    ;({ createServer } = await import('./server.js'))
    server = await createServer()
    await server.initialize()
  })

  afterEach(() => {
    vi.clearAllMocks()
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

  test('Should sign out signed-in users without back-office access and send them to the not authorised page', async () => {
    // Arrange
    const request = {
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([])
    }

    // Act
    const response = await server.inject(request)

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/auth/not-authorised')
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/^livestock_hub_jwt=;/)])
    )
    expect(response.headers['set-cookie'].join(' ')).toContain('Max-Age=0')
  })

  test('Should render the not authorised page with a sign in link', async () => {
    // Arrange
    const request = {
      method: 'GET',
      url: '/auth/not-authorised'
    }

    // Act
    const response = await server.inject(request)

    // Assert
    expect(response.statusCode).toBe(403)
    expect(response.payload).toContain(
      '>Sorry, you are not authorised to view this page</h1>'
    )
    expect(response.payload).toMatch(
      /<a href="\/auth\/login"[^>]*class="govuk-button"[^>]*>\s*Sign in\s*<\/a>/
    )
  })

  test('Should render the page not found page for an unknown path', async () => {
    // Arrange
    const request = {
      method: 'GET',
      url: '/no-such-page',
      auth: hubAuth([PERMISSIONS.backOffice])
    }

    // Act
    const response = await server.inject(request)

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.payload).toContain('Page not found')
    expect(response.payload).toContain(
      'If you typed the web address, check it is correct.'
    )
    expect(response.payload).toContain(
      'href="https://www.gov.uk/government/organisations/british-cattle-movement-service"'
    )
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
    mocks.searchHoldings.mockResolvedValueOnce(
      holdingsPage(['22/001/0001', '22/002/0002'], 11)
    )

    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Lavendon&page=abc',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
    expect(mocks.searchHoldings).toHaveBeenCalledWith({
      search: 'Lavendon',
      page: 1,
      pageSize: 25
    })
    expect(response.payload).toContain('<strong>11</strong> holdings match')
    expect(response.payload).toContain('href="/cattle/holdings/22/002/0002"')
    expect(response.payload).not.toContain('Page 1 of')
  })

  test.each([
    [
      'Oakfield',
      1,
      '<h2 class="govuk-body govuk-!-text-break-word"><strong>1</strong> holding matches ‘Oakfield’</h2>'
    ],
    [
      'Lavendon',
      11,
      '<h2 class="govuk-body govuk-!-text-break-word"><strong>11</strong> holdings match ‘Lavendon’</h2>'
    ],
    [
      '<b>x</b>',
      0,
      '<h2 class="govuk-body govuk-!-text-break-word"><strong>0</strong> holdings match ‘&lt;b&gt;x&lt;/b&gt;’</h2>'
    ]
  ])(
    'Should render the match count for %s',
    async (search, total, expected) => {
      mocks.searchHoldings.mockResolvedValueOnce(
        holdingsPage(total ? ['22/001/0001'] : [], total)
      )

      const response = await server.inject({
        method: 'GET',
        url: `/holdings?search=${encodeURIComponent(search)}`,
        auth: hubAuth([PERMISSIONS.backOffice])
      })

      expect(response.payload).toContain(expected)
      expect(response.payload.match(/<h1[\s>]/g)).toHaveLength(1)
    }
  )

  test('Should escape the search term in the page title', async () => {
    mocks.searchHoldings.mockResolvedValueOnce(holdingsPage([], 0))

    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${encodeURIComponent('<b>x</b>')}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain(
      '0 results for ‘&lt;b&gt;x&lt;/b&gt;’ - Find a holding - Livestock Information'
    )
  })

  test('Should limit the search input to 100 characters and link it to the examples hint', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain('maxlength="100"')
    expect(response.payload).toContain(
      'aria-describedby="search-holdings-hint"'
    )
    expect(response.payload).toContain('id="search-holdings-hint"')
    expect(response.payload).toContain('town or county')
  })

  test('Should accept a search longer than 100 characters', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${'a'.repeat(150)}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
  })

  test('Should render results as a table with a row header link', async () => {
    mocks.searchHoldings.mockResolvedValueOnce(holdingsPage(['22/001/0001']))

    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Oakfield',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).toContain('Holdings search results')
    expect(response.payload).toMatch(
      /<th scope="row"[^>]*>\s*<a class="govuk-link" href="\/cattle\/holdings\/22\/001\/0001">/
    )
    expect(response.payload).not.toContain('You can search using:')
    expect(response.payload).not.toContain(
      'aria-describedby="search-holdings-hint"'
    )
  })

  test.each([
    ['Lavendon', 11, 'Showing 11 results'],
    ['Oakfield', 1, 'Showing 1 result']
  ])(
    'Should render the results summary for %s',
    async (search, total, expected) => {
      mocks.searchHoldings.mockResolvedValueOnce(
        holdingsPage(['22/001/0001'], total)
      )

      const response = await server.inject({
        method: 'GET',
        url: `/holdings?search=${search}`,
        auth: hubAuth([PERMISSIONS.backOffice])
      })

      expect(response.payload).toContain(expected)
    }
  )

  test('Should not render a table when nothing matches', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=zzzznomatch',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).not.toContain('<table')
    expect(response.payload).not.toContain('Holdings search results')
  })

  test('Should render the no-match state when the BE4FE rejects the search term', async () => {
    const rejected = new Error('400 - Invalid search')
    rejected.statusCode = 400
    mocks.searchHoldings.mockRejectedValueOnce(rejected)

    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${encodeURIComponent('farm#1')}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      '<h2 class="govuk-body govuk-!-text-break-word"><strong>0</strong> holdings match ‘farm#1’</h2>'
    )
    expect(response.payload).toContain('Clear search')
    expect(response.payload).not.toContain('<table')
  })

  test.each([
    ['a 503', 503, 503, 'Sorry, the service is unavailable'],
    ['no', undefined, 500, 'Sorry, there is a problem with the service']
  ])(
    'Should render the error page when the BE4FE fails with %s status code',
    async (_label, statusCode, expectedStatusCode, expectedHeading) => {
      const unavailable = new Error('be4fe down')
      unavailable.statusCode = statusCode
      mocks.searchHoldings.mockRejectedValueOnce(unavailable)

      const response = await server.inject({
        method: 'GET',
        url: '/holdings?search=Farm',
        auth: hubAuth([PERMISSIONS.backOffice])
      })

      expect(response.statusCode).toBe(expectedStatusCode)
      expect(response.payload).toContain(expectedHeading)
      expect(response.payload).not.toContain('be4fe down')
    }
  )

  test('Should not render sort links', async () => {
    mocks.searchHoldings.mockResolvedValueOnce(holdingsPage(['22/001/0001']))

    const response = await server.inject({
      method: 'GET',
      url: '/holdings?search=Lavendon',
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.payload).not.toContain('lis-sortable-table__link')
    expect(response.payload).not.toContain('aria-sort')
  })

  test('Should render pagination without sort parameters', async () => {
    const result = await server.render('holdings/holdings', {
      pageTitle: 'Page 2 of 3 - Find a holding',
      search: 'farm',
      searched: true,
      total: 60,
      results: [
        {
          cph: '22/001/0001',
          href: '/cattle/holdings/22/001/0001',
          location: 'Oakfield Farm',
          status: 'Active'
        }
      ],
      pagination: {
        currentPage: 2,
        totalPages: 3,
        totalItems: 60,
        itemsPerPage: 25
      }
    })
    const hrefs = [...result.matchAll(/href="([^"]*)"/g)].map(([, href]) =>
      href.replaceAll('&amp;', '&')
    )

    expect(result).toContain('Showing 26 to 50 of 60 results')
    expect(result).toContain('govuk-pagination__prev')
    expect(result).toContain('govuk-pagination__next')
    expect(hrefs).toContain('/holdings?search=farm&page=3')
    expect(hrefs.join(' ')).not.toMatch(/sort=|direction=/)
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

  describe('in maintenance', () => {
    let maintenanceServer

    beforeAll(async () => {
      config.set('maintenance.availableFrom', '2026-11-19T09:00')
      maintenanceServer = await createServer()
      await maintenanceServer.initialize()
    })

    afterAll(async () => {
      config.set('maintenance.availableFrom', '')
      await maintenanceServer?.stop({ timeout: 0 })
    })

    test('Should answer pages with the service unavailable page', async () => {
      // Arrange
      const request = {
        method: 'GET',
        url: '/holdings',
        auth: hubAuth([PERMISSIONS.backOffice])
      }

      // Act
      const response = await maintenanceServer.inject(request)

      // Assert
      expect(response.statusCode).toBe(503)
      expect(response.payload).toContain('Sorry, the service is unavailable')
      expect(response.payload).toContain('9am on Thursday 19 November 2026')
      expect(response.headers['retry-after']).toBeDefined()
      expect(mocks.searchHoldings).not.toHaveBeenCalled()
    })

    test('Should keep the health check up', async () => {
      // Arrange
      const request = {
        method: 'GET',
        url: '/health'
      }

      // Act
      const response = await maintenanceServer.inject(request)

      // Assert
      expect(response.statusCode).toBe(200)
    })
  })

  test('Should not answer with the service unavailable page when not in maintenance', async () => {
    // Arrange
    const request = {
      method: 'GET',
      url: '/holdings',
      auth: hubAuth([PERMISSIONS.backOffice])
    }

    // Act
    const response = await server.inject(request)

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.payload).not.toContain('Sorry, the service is unavailable')
    expect(response.headers['retry-after']).toBeUndefined()
  })
})
