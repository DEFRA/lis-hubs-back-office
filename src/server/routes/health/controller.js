import { statusCodes } from '@livestock/infrastructure/status-codes'

export const healthController = {
  handler(_request, h) {
    return h.response({ message: 'success' }).code(statusCodes.ok)
  }
}
