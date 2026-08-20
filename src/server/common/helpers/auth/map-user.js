/**
 * Map provider-specific OIDC claims to the hub user shape.
 *
 * @param {object} payload verified ID token claims
 * @param {{ providerId: string, providerConfig: object }} context provider details
 * @returns {object} hub user
 */
export function mapUser(payload, { providerId, providerConfig }) {
  return {
    sub: payload.sub,
    email: payload.email ?? '',
    firstName: payload.firstName ?? payload.given_name ?? '',
    lastName: payload.lastName ?? payload.family_name ?? '',
    serviceId: payload.serviceId ?? providerConfig.serviceId,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    loa: payload.loa ?? '',
    amr: Array.isArray(payload.amr) ? payload.amr : [],
    authProvider: providerId
  }
}
