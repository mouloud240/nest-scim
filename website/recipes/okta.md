# Connect Okta

This package implements SCIM 2.0 User endpoints. You still configure the Okta app integration, choose the attributes to provision, and provide authentication credentials accepted by your Nest guard.

## Before you start

- Deploy the API over HTTPS at a URL reachable by your Okta org.
- Confirm `/scim/v2/ServiceProviderConfig` and `/scim/v2/Schemas` respond without user-route credentials.
- Configure a bearer-token guard on `/Users` and store the token as a secret.
- Map every attribute you plan to filter or match in `attributePathMap`.
- Confirm SCIM JSON request bodies are parsed as described in [Getting started](/guide/getting-started#parse-scim-request-bodies).

## Configure a private integration

The Okta Developer guide describes creating a private SCIM integration with the SCIM 2.0 test app:

1. In the Okta Admin Console, add the SCIM 2.0 test app that matches your authentication method.
2. Open **Provisioning** and choose **Configure API Integration**.
3. Enable the API integration and set the base URL, for example `https://api.example.com/scim/v2`.
4. For HTTP Header authentication, enter the bearer token expected by your Nest guard.
5. Run **Test API Credentials**, then save the configuration.
6. Assign a test user to the integration and verify the resulting resource in your application.

Okta supports multiple authentication approaches. This package does not implement OAuth token issuance; your application guard decides how to validate incoming credentials.

## Review provisioning behavior

Under **Provisioning → To App**, enable only the user lifecycle actions your service has tested: create users, update user attributes, and deactivate users. Review profile mappings against the attributes your mapper supports. Okta may send a password if that option is enabled; the package treats `password` as write-only and your mapper must never return it.

This package does not expose `/Groups`. Do not enable group push or group import for this endpoint. Configure and test user provisioning first.

## Troubleshoot

- Check the Okta System Log for credential tests and provisioning requests.
- Confirm that the configured URL includes the correct base path and uses HTTPS.
- Verify that the guard accepts the token format Okta sends.
- Check that `userName`, `externalId`, and any matching filters are mapped and unique in your store.
- If requests with bodies fail, check the `application/scim+json` parser setup.

Official instructions: [Add a private SCIM integration](https://developer.okta.com/docs/guides/scim-provisioning-integration-connect/main/) and [Build your SCIM API service](https://developer.okta.com/docs/guides/scim-provisioning-integration-prepare/main/).
