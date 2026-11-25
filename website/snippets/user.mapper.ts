import {
  ScimUserMapperToken,
  type ScimUser,
  type ScimUserCreate,
  type ScimUserMapper,
} from '@nest-scim/core';

export interface AppUser {
  id: string;
  login: string;
  fullName: string | null;
  active: boolean | null;
  emails: Array<{ address: string; kind: string; primary: boolean }>;
}

@ScimUserMapperToken()
export class UserMapper implements ScimUserMapper<AppUser> {
  attributePathMap = {
    userName: 'login',
    displayName: 'fullName',
    active: 'active',
    emails: 'emails',
    'emails.value': 'emails.address',
    'emails.type': 'emails.kind',
  };

  getId = (user: AppUser): string => user.id;

  fromScim = (scim: ScimUserCreate, existing?: AppUser): AppUser => ({
    id: existing?.id ?? '',
    login: scim.userName,
    fullName: scim.displayName ?? null,
    active: scim.active ?? null,
    emails: (scim.emails ?? []).map(({ value, type, primary }) => ({
      address: value,
      kind: type ?? 'work',
      primary: primary ?? false,
    })),
  });

  toScim = (user: AppUser): ScimUser => ({
    userName: user.login,
    displayName: user.fullName ?? undefined,
    active: user.active ?? undefined,
    emails: user.emails.length
      ? user.emails.map(({ address, kind, primary }) => ({ value: address, type: kind, primary }))
      : undefined,
  });
}
