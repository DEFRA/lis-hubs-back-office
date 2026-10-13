import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { searchHoldings } from '#server/services/holdings.js'

import { holdingsController, holdingsQuerySchema } from './controller.js'

vi.mock('#server/services/holdings.js', { spy: true })

const mocks = {
  searchHoldings: vi.mocked(searchHoldings)
}

const holding = {
  cph: '22/003/0003',
  name: null,
  holding_type: 'Agricultural Holding',
  address: ['Lavendon', 'Buckinghamshire', 'MK1 1AB'],
  keeper_name: 'A Keeper'
}

const emptyResult = {
  count: 0,
  total_count: 0,
  items: [],
  page: 1,
  page_size: 25,
  total_pages: 0,
  has_next_page: false,
  has_previous_page: false
}

function envelope(items, { totalCount = items.length, page = 1 } = {}) {
  return {
    ...emptyResult,
    items,
    count: items.length,
    total_count: totalCount,
    page,
    total_pages: Math.ceil(totalCount / 25)
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
          cph: '22/001/0001',
          name: 'Oakfield Farm',
          address: ['Oakfield Farm', '', null, 'Lavendon', 'MK1 1AB']
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
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 2,
          itemsPerPage: 25
        },
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
            location: 'Oakfield Farm, Lavendon, MK1 1AB',
            status: 'Active'
          }
        ]
      })
    )
  })

  test('renders an empty location for a holding with no address lines', async () => {
    // Arrange
    const h = { view: vi.fn() }
    mocks.searchHoldings.mockResolvedValueOnce(
      envelope([{ ...holding, address: [] }])
    )

    // Act
    await holdingsController.handler(
      { query: { search: 'Lavendon', page: 1 } },
      h
    )

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'holdings/holdings',
      expect.objectContaining({
        results: [
          {
            cph: '22/003/0003',
            href: '/cattle/holdings/22/003/0003',
            location: '',
            status: 'Active'
          }
        ]
      })
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
        pagination: null
      })
    )
  })

  test('passes the pagination state for a multi-page result', async () => {
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
        pagination: {
          currentPage: 1,
          totalPages: 2,
          totalItems: 30,
          itemsPerPage: 25
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
        results: [expect.objectContaining({ cph: '22/003/0003' })],
        pagination: {
          currentPage: 2,
          totalPages: 2,
          totalItems: 30,
          itemsPerPage: 25
        }
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
