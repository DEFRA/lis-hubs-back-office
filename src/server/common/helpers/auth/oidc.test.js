import { describe, expect, test } from 'vitest'

import { mapUser } from './oidc.js'

const context = {
  providerId: 'test-provider',
  providerConfig: { serviceId: 'test-service' }
}

describe('#mapUser', () => {
  test('maps DEFRA Identity name claims', () => {
    const user = mapUser(
      { sub: 'user-1', firstName: 'Case', lastName: 'Worker' },
      context
    )

    expect(user).toEqual(
      expect.objectContaining({ firstName: 'Case', lastName: 'Worker' })
    )
  })

  test('maps Entra ID name claims', () => {
    const user = mapUser(
      { sub: 'user-1', given_name: 'Case', family_name: 'Worker' },
      context
    )

    expect(user).toEqual(
      expect.objectContaining({ firstName: 'Case', lastName: 'Worker' })
    )
  })

  test('prefers DEFRA Identity name claims when both formats are present', () => {
    const user = mapUser(
      {
        sub: 'user-1',
        firstName: 'DEFRA',
        lastName: 'Identity',
        given_name: 'Entra',
        family_name: 'ID'
      },
      context
    )

    expect(user).toEqual(
      expect.objectContaining({ firstName: 'DEFRA', lastName: 'Identity' })
    )
  })
})
