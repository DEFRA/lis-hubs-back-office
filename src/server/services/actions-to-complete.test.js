import { describe, expect, test } from 'vitest'
import { getActionsToComplete } from './actions-to-complete.js'

describe('actions to complete', () => {
  test('returns two submitted cattle registrations ready for review', async () => {
    await expect(getActionsToComplete()).resolves.toEqual([
      {
        title: 'Review cattle registration REG-MNBX1K8F',
        description: 'Submitted for CPH 10/081/1234 · 2 animals · 11 July 2026',
        url: '/cattle/register/10/081/1234/bundles/REG-MNBX1K8F'
      },
      {
        title: 'Review cattle registration REG-MN7T6R4B',
        description: 'Submitted for CPH 21/456/7890 · 1 animal · 10 July 2026',
        url: '/cattle/register/21/456/7890/bundles/REG-MN7T6R4B'
      }
    ])
  })
})
