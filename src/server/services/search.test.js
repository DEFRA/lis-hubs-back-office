import { describe, expect, test } from 'vitest'

import { getCph, getUser, searchCphs, searchUsers } from './search.js'

describe('search service', () => {
  test('searchCphs returns an empty result', async () => {
    // Act
    const result = await searchCphs()

    // Assert
    expect(result).toEqual({ items: [], total: 0 })
  })

  test('searchUsers returns an empty result', async () => {
    // Act
    const result = await searchUsers()

    // Assert
    expect(result).toEqual({ items: [], total: 0 })
  })

  test('getCph returns null', async () => {
    // Act
    const result = await getCph()

    // Assert
    expect(result).toBeNull()
  })

  test('getUser returns null', async () => {
    // Act
    const result = await getUser()

    // Assert
    expect(result).toBeNull()
  })
})
