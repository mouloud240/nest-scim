# Authentication

Pass one or more Nest guards through `ScimModule.forRoot({ auth })`. The guards protect `/Users` routes only. The module leaves `/ServiceProviderConfig` and `/Schemas` open because identity providers commonly read discovery data before they authenticate.

```ts
ScimModule.forRoot({
  basePath: '/scim/v2',
  userService: UserService,
  userMapper: UserMapper,
  auth: [ScimBearerGuard],
});
```

A guard can validate a provisioning token or delegate to your existing auth system. The SCIM package does not issue or verify tokens itself. Store secrets outside source control, use HTTPS, and apply your normal rate limits and audit policy.

Guard classes and their dependencies must be available in the module context. Pass their modules through `imports` and providers through `providers` when needed. A single guard class or an array of guard classes is accepted.

To protect discovery endpoints too, use a global guard or another app-level policy. The module's `auth` option intentionally does not attach guards to those routes.

See the [module options reference](/reference/module-options) and the [Entra ID recipe](/recipes/entra-id).
