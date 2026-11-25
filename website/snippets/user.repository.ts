import type { Page, ScimUserServicePage } from '@nest-scim/core';
import type { AppUser } from './user.mapper';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<AppUser | null>;
  findByLogin(login: string): Promise<AppUser | null>;
  findByExternalId(externalId: string): Promise<AppUser | null>;
  insert(user: AppUser): Promise<AppUser>;
  replace(user: AppUser): Promise<AppUser>;
  remove(id: string): Promise<void>;
  list(page: ScimUserServicePage): Promise<Page<AppUser>>;
}
