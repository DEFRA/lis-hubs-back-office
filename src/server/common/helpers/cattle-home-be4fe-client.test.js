import { afterEach, describe, expect, test, vi } from 'vitest'

import { cattleHomeBe4FeClient as client } from './cattle-home-be4fe-client.js'

describe('CattleHomeBe4FeClient.searchHoldings()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('requests the page of holdings and returns the payload', async () => {
    // Arrange
    const payload = {
      count: 1,
      total_count: 1,
      items: [{ cph: '12/345/0001', address: ['Oakfield Farm'] }],
      page: 2,
      page_size: 25,
      total_pages: 2,
      has_next_page: false,
      has_previous_page: true
    }
    const get = vi
      .spyOn(client, '_get')
      .mockResolvedValueOnce({ res: { statusCode: 200 }, payload })

    // Act
    const result = await client.searchHoldings({
      search: 'Oakfield',
      page: 2,
      pageSize: 25
    })

    // Assert
    expect(get).toHaveBeenCalledWith(
      'api/cphs?search=Oakfield&page=2&pageSize=25'
    )
    expect(result).toEqual(payload)
  })

  test('encodes the search term', async () => {
    // Arrange
    const get = vi
      .spyOn(client, '_get')
      .mockResolvedValueOnce({ res: { statusCode: 200 }, payload: {} })

    // Act
    await client.searchHoldings({
      search: '12/345 & 0001',
      page: 1,
      pageSize: 25
    })

    // Assert
    expect(get).toHaveBeenCalledWith(
      'api/cphs?search=12%2F345+%26+0001&page=1&pageSize=25'
    )
  })

  test('propagates request errors', async () => {
    // Arrange
    const badRequest = new Error('400 - Invalid search')
    badRequest.statusCode = 400
    vi.spyOn(client, '_get').mockRejectedValueOnce(badRequest)

    // Act
    let error
    try {
      await client.searchHoldings({ search: 'Oakfield', page: 1, pageSize: 25 })
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBe(badRequest)
  })
})
