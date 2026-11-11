import { afterEach, describe, expect, test, vi } from 'vitest'

import { createServiceClient } from '@defra/lis-hubs-infra-core'

import * as client from './cattle-home-be4fe-client.js'

const service = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
}))

vi.mock('@defra/lis-hubs-infra-core', () => ({
  createServiceClient: vi.fn(() => service)
}))

describe('CattleHomeBe4FeClient.searchHoldings()', () => {
  afterEach(() => {
    vi.resetAllMocks()
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
    service.get.mockResolvedValueOnce({ res: { statusCode: 200 }, payload })

    // Act
    const result = await client.searchHoldings({
      search: 'Oakfield',
      page: 2,
      pageSize: 25
    })

    // Assert
    expect(service.get).toHaveBeenCalledWith(
      'api/cphs?search=Oakfield&page=2&pageSize=25'
    )
    expect(result).toEqual(payload)
  })

  test('encodes the search term', async () => {
    // Arrange
    service.get.mockResolvedValueOnce({
      res: { statusCode: 200 },
      payload: {}
    })

    // Act
    await client.searchHoldings({
      search: '12/345 & 0001',
      page: 1,
      pageSize: 25
    })

    // Assert
    expect(service.get).toHaveBeenCalledWith(
      'api/cphs?search=12%2F345+%26+0001&page=1&pageSize=25'
    )
  })

  test('propagates request errors', async () => {
    // Arrange
    const badRequest = new Error('400 - Invalid search')
    badRequest.statusCode = 400
    service.get.mockRejectedValueOnce(badRequest)

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

describe('CattleHomeBe4FeClient circuit breaker', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetAllMocks()
  })

  test('uses the configured failure threshold', async () => {
    // Arrange
    vi.stubEnv('CATTLE_HOME_API_CIRCUIT_BREAKER_FAILURE_THRESHOLD', '1')
    vi.resetModules()
    vi.mocked(createServiceClient).mockReturnValue(service)

    // Act
    await import('./cattle-home-be4fe-client.js')

    // Assert
    expect(vi.mocked(createServiceClient)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        circuitBreaker: expect.objectContaining({ failureThreshold: 1 })
      })
    )
  })
})
