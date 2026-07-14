# Back Office

Role: deployable hub application for Defra staff and approved external staff.

Purpose: to manage and support the lifecycle of an animal, the owner, and keepers.

Authentication:

- Microsoft Entra ID only

Expected dependencies:

- `@livestock/hubs-infra-access`
- `@livestock/hubs-infra-core`
- `@livestock/hubs-infra-registry`
- `@livestock/ui-services`

Current state:

- minimal deployable shell exists
- `/` now renders a richer back-office welcome page and signed-in dashboard
- `/health` responds with a simple health payload
- static asset and favicon routes are now wired through the back-office server shell
- content security policy is now owned by the back-office server shell
- shared module metadata comes from `@livestock/hubs-infra-registry`
- authentication, sessions and access decisions come from `@livestock/hubs-infra-access`

## OIDC callback

Microsoft Entra ID must redirect to `/sso`. The complete redirect URI is the
public `HUB_ORIGIN` followed by `/sso`. The path defaults to `/sso` and can be
changed with `OIDC_REDIRECT_PATH`; the Entra application registration must be
updated to exactly the same URI whenever it changes.

Remaining work:

- add back-office-specific operational modules and capability views
- add the remaining deployment packaging and environment conventions needed for standalone hosting
