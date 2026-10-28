import { BaseClient } from '@defra/lis-hubs-infra-core'

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

class CattleHomeBe4FeClient extends BaseClient {
  /**
   * @param {object} options
   * @param {string} options.environment 'local' | 'docker_compose' | 'dev' | 'test' | 'ext-test' | 'perf-test' | 'prod'
   * @param {string} [options.apiKey] API key sent to the cattle-home BE4FE as x-api-key
   * @param {number} [options.timeout] total milliseconds allowed for the response headers and body
   * @param {{ failureThreshold?: number, resetTimeout?: number }} [options.circuitBreaker] circuit breaker settings; see BaseClient for the defaults
   */
  constructor({ environment, apiKey, timeout, circuitBreaker }) {
    super({
      environment,
      serviceName: 'lis-be4fe-cattle-home',
      port: localPort,
      apiKey,
      timeout,
      circuitBreaker
    })
  }

  /**
   * @param {object} options
   * @param {string} options.search
   * @param {number} options.page
   * @param {number} options.pageSize
   * @returns {Promise<HoldingSearchPage>} one page of the holdings matching the search
   */
  async searchHoldings({ search, page, pageSize }) {
    const query = new URLSearchParams({
      search,
      page: String(page),
      pageSize: String(pageSize)
    })
    const { payload } = await this._get(`api/cphs?${query}`)
    return payload
  }
}

export const cattleHomeBe4FeClient = new CattleHomeBe4FeClient({
  environment: config.get('environment'),
  apiKey: config.get('cattleHomeApi.apiKey'),
  timeout: config.get('cattleHomeApi.timeout'),
  circuitBreaker: config.get('cattleHomeApi.circuitBreaker')
})
