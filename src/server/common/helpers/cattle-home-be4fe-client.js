import { createServiceClient } from '@defra/lis-hubs-infra-core'

import { config } from '#config/config.js'

/**
 * @typedef {object} HoldingSummary
 * @property {string} cph
 * @property {string | null} name
 * @property {string | null} holding_type
 * @property {string[]} address
 * @property {string | null} keeper_name
 */

/**
 * @typedef {object} HoldingSearchPage
 * @property {number} count
 * @property {number} total_count
 * @property {HoldingSummary[]} items
 * @property {number} page
 * @property {number} page_size
 * @property {number} total_pages
 * @property {boolean} has_next_page
 * @property {boolean} has_previous_page
 */

// The BE4FE always stays in docker per the project's local dev workflow, so
// the hub reaches it via its published port whether it runs as 'local' or
// 'docker_compose'.
const localPort = 8087

const be4fe = createServiceClient({
  environment: config.get('environment'),
  serviceName: 'lis-be4fe-cattle-home',
  port: localPort,
  apiKey: config.get('cattleHomeApi.apiKey'),
  timeout: config.get('cattleHomeApi.timeout'),
  circuitBreaker: config.get('cattleHomeApi.circuitBreaker')
})

/**
 * @param {object} options
 * @param {string} options.search
 * @param {number} options.page
 * @param {number} options.pageSize
 * @returns {Promise<HoldingSearchPage>} one page of the holdings matching the search
 */
export async function searchHoldings({ search, page, pageSize }) {
  const query = new URLSearchParams({
    search,
    page: String(page),
    pageSize: String(pageSize)
  })
  const { payload } = await be4fe.get(`api/cphs?${query}`)
  return payload
}
