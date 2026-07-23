import {
  getHubAuthSession,
  hasRole
} from '@livestock/hubs-infra-access/auth'
import { SPECIES } from '@livestock/hubs-infra-registry'

import { getActionsToComplete } from '#server/services/actions-to-complete.js'

const afternoonStartsAt = 12
const eveningStartsAt = 18

export const homeController = {
  async handler(request, h) {
    const authenticatedUser = getHubAuthSession(request)

    if (!authenticatedUser) {
      return h.view('home/welcome', {
        pageTitle: 'Welcome',
        heading: 'Livestock back office',
        supportedSpecies: SPECIES,
        loginUrl: '/auth/login?returnUrl=/'
      })
    }

    return h.view('home/dashboard', {
      pageTitle: 'Dashboard',
      authenticatedUser,
      greeting: getGreeting(),
      actionsToComplete: await getActionsToComplete({
        user: authenticatedUser
      }),
      canFindUsers: hasRole(authenticatedUser, {
        role: 'lis-role-caseworker-super'
      }),
      logoutUrl: '/auth/logout'
    })
  }
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()

  if (hour < afternoonStartsAt) {
    return 'Good morning'
  }

  if (hour < eveningStartsAt) {
    return 'Good afternoon'
  }

  return 'Good evening'
}
