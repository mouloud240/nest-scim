import { Injectable } from '@nestjs/common';
import type { Page, ScimUserServicePage } from '@nest-scim/core';
import type { AppUser } from './user.mapper';
import type { UserRepository } from './user.repository';

@Injectable()
export class UsersRepository implements UserRepository {
  // Replace these examples with your database queries.
  async findById(_id: string): Promise<AppUser | null> {
    return null;
  }
  async findByLogin(_login: string): Promise<AppUser | null> {
    return null;
  }
  async findByExternalId(_externalId: string): Promise<AppUser | null> {
    return null;
  }
  async insert(user: AppUser): Promise<AppUser> {
    return { ...user, id: crypto.randomUUID() };
  }
  async replace(user: AppUser): Promise<AppUser> {
    return user;
  }
  async remove(_id: string): Promise<void> {}

  async list(_page: ScimUserServicePage): Promise<Page<AppUser>> {
    // Translate _page.where to SQL / Prisma / your query API.
    return { items: [], totalResults: 0 };
  }
}
