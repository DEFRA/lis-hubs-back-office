export const PAGE_SIZE = 20

// These functions are the integration boundary for the CPH and user data sources.
/** @returns {Promise<{items: Array<object>, total: number}>} */
export async function searchCphs() {
  return { items: [], total: 0 }
}

/** @returns {Promise<{items: Array<object>, total: number}>} */
export async function searchUsers() {
  return { items: [], total: 0 }
}

/** @returns {Promise<object | null>} */
export async function getCph() {
  return null
}

/** @returns {Promise<object | null>} */
export async function getUser() {
  return null
}
