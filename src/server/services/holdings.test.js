import { describe, expect, test } from 'vitest'

import { PAGE_SIZE, searchHoldings } from './holdings.js'

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

describe('searchHoldings()', () => {
  test('uses a page size of 25', () => {
    // Assert
    expect(PAGE_SIZE).toBe(25)
  })

  test.each([
    ['identifier', '22/001/0001'],
    ['name', 'oakfield'],
    ['address line 2', 'Church Lane'],
    ['post town', 'Shrewsbury'],
    ['locality', 'Shropshire'],
    ['postcode', 'SY4 1AB'],
    ['mark', 'UK 324537']
  ])('matches on %s', async (_field, search) => {
    // Act
    const result = await searchHoldings({ search })

    // Assert
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/001/0001'
    ])
    expect(result.totalCount).toBe(1)
  })

  test('matches case-insensitively', async () => {
    // Act
    const result = await searchHoldings({ search: 'OAKFIELD farm' })

    // Assert
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/001/0001'
    ])
  })

  test('matches on address line 1', async () => {
    // Act
    const result = await searchHoldings({ search: 'Meadow View' })

    // Assert
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/003/0003'
    ])
  })

  test.each([
    '22/001/0001',
    '220010001',
    '22 001 0001',
    '0001',
    '001/0001',
    'SY4 1AB',
    'sy41ab',
    'SY4',
    'UK 324537',
    'uk324537',
    '324537',
    ' sy4 1ab '
  ])('matches the holding 22/001/0001 for %j', async (search) => {
    // Act
    const result = await searchHoldings({ search })

    // Assert
    expect(result.values.map(({ identifier }) => identifier)).toContain(
      '22/001/0001'
    )
  })

  test.each(['///', '- -'])(
    'matches nothing for the punctuation-only term %j',
    async (search) => {
      // Act
      const result = await searchHoldings({ search })

      // Assert
      expect(result).toEqual(emptyResult)
    }
  )

  test('does not fail on holdings with no name', async () => {
    // Act
    const result = await searchHoldings({ search: 'MK1 1AB' })

    // Assert
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/003/0003'
    ])
  })

  test.each(['', '   ', undefined])(
    'returns nothing for the blank term %j',
    async (search) => {
      // Act
      const result = await searchHoldings({ search })

      // Assert
      expect(result).toEqual(emptyResult)
    }
  )

  test('returns nothing when no holding matches', async () => {
    // Act
    const result = await searchHoldings({ search: 'no such holding' })

    // Assert
    expect(result).toEqual(emptyResult)
  })

  test('sorts matches by identifier ascending', async () => {
    // Act
    const result = await searchHoldings({ search: 'Farm' })

    // Assert
    const identifiers = result.values.map(({ identifier }) => identifier)
    expect(identifiers).toEqual([...identifiers].sort())
    expect(identifiers[0]).toBe('03/202/0021')
  })

  test('returns the paginated envelope for a single page of results', async () => {
    // Act
    const result = await searchHoldings({ search: 'Oakfield' })

    // Assert
    expect(result).toEqual({
      values: [expect.objectContaining({ identifier: '22/001/0001' })],
      count: 1,
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      nextCursor: null
    })
  })

  test('returns the paginated envelope for the middle of several pages', async () => {
    // Act
    const result = await searchHoldings({
      search: 'Lavendon',
      page: 2,
      pageSize: 5
    })

    // Assert
    expect(result).toEqual(
      expect.objectContaining({
        count: 5,
        totalCount: 11,
        page: 2,
        pageSize: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
        nextCursor: null
      })
    )
  })

  test('returns the paginated envelope for the last page', async () => {
    // Act
    const result = await searchHoldings({
      search: 'Lavendon',
      page: 3,
      pageSize: 5
    })

    // Assert
    expect(result.count).toBe(1)
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/099/0099'
    ])
    expect(result.hasNextPage).toBe(false)
    expect(result.hasPreviousPage).toBe(true)
  })

  test('returns the requested page with the full total', async () => {
    // Act
    const result = await searchHoldings({
      search: 'Lavendon',
      page: 2,
      pageSize: 4
    })

    // Assert
    expect(result.totalCount).toBe(11)
    expect(result.values.map(({ identifier }) => identifier)).toEqual([
      '22/006/0006',
      '22/007/0007',
      '22/008/0008',
      '22/009/0009'
    ])
  })

  test('returns an empty page beyond the last page', async () => {
    // Act
    const result = await searchHoldings({
      search: 'Lavendon',
      page: 5,
      pageSize: 4
    })

    // Assert
    expect(result.values).toEqual([])
    expect(result.count).toBe(0)
    expect(result.totalCount).toBe(11)
    expect(result.hasNextPage).toBe(false)
  })
})
