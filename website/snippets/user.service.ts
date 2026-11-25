import { Inject, Injectable } from '@nestjs/common';
import type { Page, ScimUserService, ScimUserServicePage } from '@nest-scim/core';
import type { AppUser } from './user.mapper';
import { USERS_REPOSITORY, type UserRepository } from './user.repository';

@Injectable()
export class UserService implements ScimUserService<AppUser> {
  constructor(@Inject(USERS_REPOSITORY) private readonly users: UserRepository) {}

  findById = (id: string): Promise<AppUser | null> => this.users.findById(id);
  findByUserName = (userName: string): Promise<AppUser | null> => this.users.findByLogin(userName);
  findByExternalId = (externalId: string): Promise<AppUser | null> =>
    this.users.findByExternalId(externalId);
  create = (user: AppUser): Promise<AppUser> => this.users.insert(user);
  update = (user: AppUser): Promise<AppUser> => this.users.replace(user);
  deleteById = (id: string): Promise<void> => this.users.remove(id);

  list = (page: ScimUserServicePage): Promise<Page<AppUser>> => this.users.list(page);
}
