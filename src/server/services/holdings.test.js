import { afterEach, describe, expect, test, vi } from 'vitest'

import { cattleHomeBe4FeClient } from '#server/common/helpers/cattle-home-be4fe-client.js'

import { PAGE_SIZE, searchHoldings } from './holdings.js'

vi.mock('#server/common/helpers/cattle-home-be4fe-client.js')

const mocks = {
  searchHoldings: vi.mocked(cattleHomeBe4FeClient.searchHoldings)
}

describe('searchHoldings()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('uses a page size of 25', () => {
    // Assert
    expect(PAGE_SIZE).toBe(25)
  })

  test.each(['', '   ', undefined])(
    'returns an empty page without calling the BE4FE for the blank term %j',
    async (search) => {
      // Act
      const result = await searchHoldings({ search })

      // Assert
      expect(mocks.searchHoldings).not.toHaveBeenCalled()
      expect(result).toEqual({
        count: 0,
        total_count: 0,
        items: [],
        page: 1,
        page_size: 25,
        total_pages: 0,
        has_next_page: false,
        has_previous_page: false
      })
    }
  )

  test('searches the BE4FE with the trimmed term, page and page size', async () => {
    // Arrange
    mocks.searchHoldings.mockResolvedValueOnce({})

    // Act
    await searchHoldings({ search: '  Oakfield  ', page: 3, pageSize: 10 })

    // Assert
    expect(mocks.searchHoldings).toHaveBeenCalledWith({
      search: 'Oakfield',
      page: 3,
      pageSize: 10
    })
  })

  test('defaults to the first page of 25', async () => {
    // Arrange
    mocks.searchHoldings.mockResolvedValueOnce({})

    // Act
    await searchHoldings({ search: 'Oakfield' })

    // Assert
    expect(mocks.searchHoldings).toHaveBeenCalledWith({
      search: 'Oakfield',
      page: 1,
      pageSize: 25
    })
  })

  test('returns the BE4FE page as it is', async () => {
    // Arrange
    const page = {
      count: 1,
      total_count: 26,
      items: [
        {
          cph: '12/345/0001',
          name: 'Oakfield Farm',
          holding_type: 'Agricultural Holding',
          address: ['Oakfield Farm', 'Shrewsbury', 'SY1 1AB'],
          keeper_name: 'A Keeper'
        }
      ],
      page: 2,
      page_size: 25,
      total_pages: 2,
      has_next_page: false,
      has_previous_page: true
    }
    mocks.searchHoldings.mockResolvedValueOnce(page)

    // Act
    const result = await searchHoldings({ search: 'Oakfield', page: 2 })

    // Assert
    expect(result).toEqual(page)
  })

  test('propagates BE4FE errors', async () => {
    // Arrange
    const unavailable = new Error('Request failed - 503')
    mocks.searchHoldings.mockRejectedValueOnce(unavailable)

    // Act
    let error
    try {
      await searchHoldings({ search: 'Oakfield' })
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBe(unavailable)
  })
})
