import {
  PERMISSIONS,
  hasPermission
} from '@defra/lis-hubs-infra-access/authorization'

import { getActionsToComplete } from '#server/services/actions-to-complete.js'

const afternoonStartsAt = 12
const eveningStartsAt = 18

export const homeController = {
  async handler(request, h) {
    const authenticatedUser = request.auth.credentials.user

    return h.view('home/dashboard', {
      pageTitle: 'Dashboard',
      authenticatedUser,
      greeting: getGreeting(),
      actionsToComplete: await getActionsToComplete({
        user: authenticatedUser
      }),
      canApprovePassport: hasPermission(authenticatedUser, {
        permission: PERMISSIONS.passportApprover
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
