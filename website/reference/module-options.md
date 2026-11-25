# ScimModuleOptions

`ScimModule.forRoot(options)` returns a Nest dynamic module. `basePath`, `userService`, and `userMapper` are required; invalid configuration fails during app bootstrap.

| Option                  | Type                                       | Required | Description                                                                    |
| ----------------------- | ------------------------------------------ | -------: | ------------------------------------------------------------------------------ |
| `basePath`              | `string`                                   |      Yes | Route prefix, for example `/scim/v2`. Root-level `''` and `'/'` are supported. |
| `userService`           | `Type<unknown>`                            |      Yes | Class implementing `ScimUserService<U>`.                                       |
| `userMapper`            | `Type<unknown>`                            |      Yes | Class implementing `ScimUserMapper<U>`.                                        |
| `auth`                  | `Type<CanActivate> \| Type<CanActivate>[]` |       No | Guards applied to `/Users` routes only.                                        |
| `serviceProviderConfig` | `ScimSPCOverrides`                         |       No | Overrides for the discovery resource, including PATCH and filter limits.       |
| `imports`               | `ModuleImport[]`                           |       No | Nest modules needed by your SPI providers.                                     |
| `providers`             | `Provider[]`                               |       No | Providers made available inside the generated dynamic module.                  |

## Example

```ts
ScimModule.forRoot({
  basePath: '/scim/v2',
  userService: UserService,
  userMapper: UserMapper,
  auth: [ScimBearerGuard],
  imports: [UsersModule],
  serviceProviderConfig: {
    documentationUri: 'https://docs.example.com/scim',
    filter: { maxResults: 200 },
    sort: { supported: false },
  },
});
```

The discovery resource merges partial overrides with RFC defaults. Sections merge by key; `authenticationSchemes`, when supplied, replaces the complete array. The default configuration advertises PATCH and filtering (maximum 200 results), and does not advertise bulk, sort, change-password, or ETag support.

Discovery routes (`/ServiceProviderConfig`, `/Schemas`) are unguarded by `auth`. See [Authentication](/guide/authentication) for options to protect them at the application level.
