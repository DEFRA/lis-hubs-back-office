# Back Office

Role: deployable hub application for Defra staff and approved external staff.

Purpose: to manage and support the lifecycle of an animal, the owner, and keepers.

Authentication:

- internal SSO primary
- Defra CI fallback

Expected dependencies:

- `@livestock/hub-core`
- `@livestock/hub-registry`
- `@livestock/hub-access`
- `@livestock/infrastructure`

Current state:

- minimal deployable shell exists
- `/` now renders a richer back-office welcome page and signed-in dashboard
- `/health` responds with a simple health payload
- static asset and favicon routes are now wired through the back-office server shell
- content security policy is now owned by the back-office server shell
- shared module metadata comes from `@livestock/hub-registry`
- shared session access comes from `@livestock/hub-core`
- shared access filtering comes from `@livestock/hub-access`
- back-office authentication is wired through the shared hub auth mechanics

Remaining work:

- add back-office-specific operational modules and capability views
- add the remaining deployment packaging and environment conventions needed for standalone hosting
