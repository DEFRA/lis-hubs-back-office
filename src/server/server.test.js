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
      '<h2 class="govuk-body"><strong>1</strong> holding matches ‘Oakfield’</h2>'
    ],
    [
      'Lavendon',
      11,
      '<h2 class="govuk-body"><strong>11</strong> holdings match ‘Lavendon’</h2>'
    ],
    [
      '<b>x</b>',
      0,
      '<h2 class="govuk-body"><strong>0</strong> holdings match ‘&lt;b&gt;x&lt;/b&gt;’</h2>'
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

  test('Should accept a search longer than 100 characters', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/holdings?search=${'a'.repeat(150)}`,
      auth: hubAuth([PERMISSIONS.backOffice])
    })

    expect(response.statusCode).toBe(200)
  })

  test('Should render results as a table with a row header link and no instructions', async () => {
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
