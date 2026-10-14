import { describe, expect, test, vi } from 'vitest'

const { createAll, LayoutOne, LayoutTwo, ErrorPageOne, ScrollableTable } =
  vi.hoisted(() => ({
    createAll: vi.fn(),
    LayoutOne: class {},
    LayoutTwo: class {},
    ErrorPageOne: class {},
    ScrollableTable: class {}
  }))

vi.mock('govuk-frontend', () => ({ createAll }))
vi.mock('@defra/lis-infra-ui-services/components/layout', () => ({
  layoutComponents: [LayoutOne, LayoutTwo]
}))
vi.mock('@defra/lis-infra-ui-services/components/error-pages', () => ({
  errorPageComponents: [LayoutTwo, ErrorPageOne]
}))
vi.mock('@defra/lis-infra-ui-services/components/scrollable-table', () => ({
  ScrollableTable
}))

describe('browser application bootstrap', () => {
  test('starts each shared layout component, each error page component, then the scrollable table, starting a component listed twice once', async () => {
    await import('./application.js')

    expect(createAll.mock.calls).toEqual([
      [LayoutOne],
      [LayoutTwo],
      [ErrorPageOne],
      [ScrollableTable]
    ])
  })
})
