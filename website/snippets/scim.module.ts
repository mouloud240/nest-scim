import { Module } from '@nestjs/common';
import { ScimModule } from '@nest-scim/core';
import { ScimBearerGuard } from './scim.guard';
import { UserMapper } from './user.mapper';
import { UserService } from './user.service';
import { UsersModule } from './users.module';

@Module({
  imports: [
    ScimModule.forRoot({
      basePath: '/scim/v2',
      userService: UserService,
      userMapper: UserMapper,
      auth: [ScimBearerGuard],
      imports: [UsersModule],
      providers: [ScimBearerGuard],
      serviceProviderConfig: {
        filter: { maxResults: 200 },
      },
    }),
  ],
})
export class AppModule {}
