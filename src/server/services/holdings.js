import { cattleHomeBe4FeClient } from '#server/common/helpers/cattle-home-be4fe-client.js'

/**
 * @import { HoldingSearchPage } from '#server/common/helpers/cattle-home-be4fe-client.js'
 */

export const PAGE_SIZE = 25

/**
 * @param {object} options
 * @param {string} [options.search]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @returns {Promise<HoldingSearchPage>} the BE4FE's page of matching holdings, as it returned it
 */
export async function searchHoldings({
  search,
  page = 1,
  pageSize = PAGE_SIZE
}) {
  const term = (search ?? '').trim()

  // Deliberately differs from the API, which returns everything for a blank
  // search: the page shows nothing until a term is entered.
  if (!term) {
    return {
      count: 0,
      total_count: 0,
      items: [],
      page,
      page_size: pageSize,
      total_pages: 0,
      has_next_page: false,
      has_previous_page: false
    }
  }

  return cattleHomeBe4FeClient.searchHoldings({ search: term, page, pageSize })
}
