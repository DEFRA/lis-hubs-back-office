import { describe, expect, test } from 'vitest'

import { getUser, searchUsers } from './search.js'

describe('search service', () => {
  test('searchUsers returns an empty result', async () => {
    // Act
    const result = await searchUsers()

    // Assert
    expect(result).toEqual({ items: [], total: 0 })
  })

  test('getUser returns null', async () => {
    // Act
    const result = await getUser()

    // Assert
    expect(result).toBeNull()
  })
})
