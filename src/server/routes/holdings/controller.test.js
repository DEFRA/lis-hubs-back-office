import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { searchHoldings } from '#server/services/holdings.js'

import { holdingsController, holdingsQuerySchema } from './controller.js'

vi.mock('#server/services/holdings.js', { spy: true })

const mocks = {
  searchHoldings: vi.mocked(searchHoldings)
}

const holding = {
  identifier: '22/003/0003',
  name: null,
  endDate: null,
  location: {
    address: {
      postTown: 'Lavendon',
      locality: 'Buckinghamshire',
      postcode: 'MK1 1AB'
    }
  },
  marks: [{ mark: 'UK 324788' }]
}

const emptyResult = {
  values: [],
  count: 0,
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  nextCursor: null
}

function envelope(values, { totalCount = values.length, page = 1 } = {}) {
  return {
    ...emptyResult,
    values,
    count: values.length,
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / 25)
  }
}

describe('holdingsController', () => {
  beforeAll(() => {
    mocks.searchHoldings.mockResolvedValue(emptyResult)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders only the form when there is no search term', async () => {
    // Arrange
    const h = { view: vi.fn(() => 'rendered') }

    // Act
    const response = await holdingsController.handler(
      { query: { search: '', page: 1 } },
      h
    )

    // Assert
    expect(response).toBe('rendered')
    expect(mocks.searchHoldings).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith('holdings/holdings', {
      pageTitle: 'Find a holding',
      search: '',
      searched: false,
      results: [],
      total: 0,
      resultsSummary: null,
      pagination: null
    })
  })

  test('maps matching holdings to result rows', async () => {
    // Arrange
    const h = { view: vi.fn() }
    mocks.searchHoldings.mockResolvedValueOnce(
      envelope([
        holding,
        {
          ...holding,
          identifier: '22/001/0001',
          name: 'Oakfield Farm',
          endDate: '2020-06-30T00:00:00Z'
        }
      ])
    )

    // Act
    await holdingsController.handler(
      { query: { search: 'Lavendon', page: 1 } },
      h
    )

    // Assert
    expect(mocks.searchHoldings).toHaveBeenCalledWith({
      search: 'Lavendon',
      page: 1,
      pageSize: 25
    })
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        search: 'Lavendon',
        searched: true,
        total: 2,
        pageTitle: 'Find a holding',
        resultsSummary: 'Showing 2 results',
        pagination: null,
        results: [
          {
            cph: '22/003/0003',
            href: '/cattle/holdings/22/003/0003',
            location: 'Lavendon, Buckinghamshire, MK1 1AB',
            status: 'Active'
          },
          {
            cph: '22/001/0001',
            href: '/cattle/holdings/22/001/0001',
            location: 'Oakfield Farm, Lavendon, Buckinghamshire, MK1 1AB',
            status: 'Closed'
          }
        ]
      })
    )
  })

  test.each([
    ['null end date', null, 'Active'],
    ['past end date', '2026-10-11T00:00:00Z', 'Closed'],
    ['future end date', '2026-10-13T00:00:00Z', 'Active']
  ])('derives the status from a %s', async (_label, endDate, expected) => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'))
    const h = { view: vi.fn() }
    mocks.searchHoldings.mockResolvedValueOnce(
      envelope([{ ...holding, endDate }])
    )

    // Act
    try {
      await holdingsController.handler(
        { query: { search: 'Lavendon', page: 1 } },
        h
      )
    } finally {
      vi.useRealTimers()
    }

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        results: [expect.objectContaining({ status: expected })]
      })
    )
  })

  test('summarises a single result', async () => {
    // Arrange
    const h = { view: vi.fn() }
    mocks.searchHoldings.mockResolvedValueOnce(envelope([holding]))

    // Act
    await holdingsController.handler(
      { query: { search: 'Meadow', page: 1 } },
      h
    )

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({ resultsSummary: 'Showing 1 result' })
    )
  })

  test('renders no rows when nothing matches', async () => {
    // Arrange
    const h = { view: vi.fn() }

    // Act
    await holdingsController.handler(
      { query: { search: 'nothing', page: 1 } },
      h
    )

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        searched: true,
        results: [],
        total: 0,
        resultsSummary: null,
        pagination: null
      })
    )
  })

  test('builds pagination links that keep the encoded search term', async () => {
    // Arrange
    const h = { view: vi.fn() }
    mocks.searchHoldings.mockResolvedValueOnce(envelope([], { totalCount: 30 }))

    // Act
    await holdingsController.handler(
      { query: { search: 'Old Farm', page: 1 } },
      h
    )

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        pageTitle: 'Page 1 of 2 - Find a holding',
        resultsSummary: 'Showing 1 to 25 of 30 results',
        pagination: {
          items: [
            { number: 1, href: '?search=Old+Farm&page=1', current: true },
            { number: 2, href: '?search=Old+Farm&page=2', current: false }
          ],
          previous: null,
          next: { href: '?search=Old+Farm&page=2' }
        }
      })
    )
  })

  test('clamps a page beyond the last page to the last page', async () => {
    // Arrange
    const h = { view: vi.fn() }
    mocks.searchHoldings
      .mockResolvedValueOnce(envelope([], { totalCount: 30 }))
      .mockResolvedValueOnce(envelope([holding], { totalCount: 30, page: 2 }))

    // Act
    await holdingsController.handler({ query: { search: 'Farm', page: 9 } }, h)

    // Assert
    expect(mocks.searchHoldings).toHaveBeenLastCalledWith({
      search: 'Farm',
      page: 2,
      pageSize: 25
    })
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        pageTitle: 'Page 2 of 2 - Find a holding',
        resultsSummary: 'Showing 26 to 30 of 30 results',
        results: [expect.objectContaining({ cph: '22/003/0003' })],
        pagination: expect.objectContaining({
          items: [
            expect.objectContaining({ number: 1, current: false }),
            expect.objectContaining({ number: 2, current: true })
          ]
        })
      })
    )
  })
})

describe('holdingsQuerySchema', () => {
  test.each([
    [{}, { page: 1 }],
    [
      { search: '  Oakfield  ', page: '2' },
      { search: 'Oakfield', page: 2 }
    ],
    [{ search: '' }, { search: '', page: 1 }],
    [
      { search: 'Farm', page: 'abc' },
      { search: 'Farm', page: 1 }
    ],
    [
      { search: 'Farm', page: '0' },
      { search: 'Farm', page: 1 }
    ],
    [
      { search: 'Farm', page: '1.5' },
      { search: 'Farm', page: 1 }
    ],
    [
      { search: 'Farm', utm: 'x' },
      { search: 'Farm', page: 1 }
    ]
  ])('validates %j', (query, expected) => {
    // Act
    const { value, error } = holdingsQuerySchema.validate(query)

    // Assert
    expect(error).toBeUndefined()
    expect(value).toEqual(expected)
  })

  test('truncates a search term longer than 100 characters', () => {
    // Act
    const { value, error } = holdingsQuerySchema.validate({
      search: 'a'.repeat(150)
    })

    // Assert
    expect(error).toBeUndefined()
    expect(value.search).toBe('a'.repeat(100))
  })
})
