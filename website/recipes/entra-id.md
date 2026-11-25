# Connect Microsoft Entra ID

Microsoft Entra ID can provision users to a SCIM 2.0 endpoint. This package provides User routes; it does not provide `/Groups`, so configure and test user provisioning without group synchronization.

## Prepare the service

- Publish the Nest API over HTTPS at a URL reachable by the provisioning service.
- Set the tenant URL to the full SCIM base path, such as `https://api.example.com/scim/v2`.
- Add a guard that validates the secret token configured in Entra's provisioning settings.
- Keep `/ServiceProviderConfig` and `/Schemas` reachable for discovery; the module's `auth` option protects `/Users` only.
- Map `userName`, `active`, and any matching or mapped email attributes to your domain model.
- Parse `application/scim+json` request bodies; see [Getting started](/guide/getting-started#parse-scim-request-bodies).

Microsoft Entra's SCIM guidance recommends HTTPS, bearer-token authentication, User queries, PATCH, and schema discovery. Test the exact attribute mappings and behavior in your tenant before enabling provisioning broadly.

## Configure a non-gallery app

The Microsoft Learn setup flow is subject to portal changes. In general:

1. Create a non-gallery enterprise application and open **Provisioning**.
2. Select automatic provisioning and enter the SCIM service base URL in **Tenant URL**.
3. Enter the token expected by your Nest guard in **Secret Token**.
4. Select **Test Connection** and save after it succeeds.
5. Review the user attribute mappings and choose a supported matching property, commonly `userName`.
6. Assign a test user, use on-demand provisioning, and review the provisioning logs before starting the job.

Avoid enabling group mappings: this package currently has no `/Groups` endpoint. If your Entra configuration requires groups, use a SCIM implementation that supports them.

## Authentication notes

A static bearer token can be supplied through the Secret Token field, but secure token storage, rotation, and validation are your application's responsibility. Microsoft also documents OAuth client credentials for supported configurations. The `auth` option accepts Nest guards; it does not create an OAuth server or validate Entra-issued JWTs for you.

Official instructions: [Develop a SCIM endpoint for user provisioning](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/use-scim-to-provision-users-and-groups) and [On-premises SCIM provisioning](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/on-premises-scim-provisioning).
