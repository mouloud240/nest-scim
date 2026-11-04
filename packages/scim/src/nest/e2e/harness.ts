/**
 * Dev-only e2e harness — re-usable for the error corpus and for the M5
 * example app. Uses @nestjs/platform-express + supertest (devDependencies
 * ONLY — nothing in the library depends on these).
 *
 * The IdP-domain side of the SPI: an in-memory user service + a mapper
 * with strict absence semantics (RFC 7644 §3.5.1).
 */
import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate, Type } from '@nestjs/common';
import { ScimModule } from '../scim-module';
import { ScimUserAdapter } from '../scim-user-adapter';
import { ScimUserMapperToken } from '../scim-user-mapper.decorator';
import type { ScimUserService, ScimUserMapper } from '../spi';
import type { Page } from '../../core/types/list';
import { SCIM_USER_SCHEMA, ScimUserCreate } from '../../core/types/user';
import type { ScimSPCOverrides } from '../../core/spc/merge-provider-config';

interface DemoUser {
  key: string;
  userName: string;
  displayName: string | null;
  emails: Array<{ value: string; type: string }> | [];
  externalId: string | null;
  created: Date;
  lastModified: Date;
}

/** Store over plain arrays — enough to exercise every SPI flow. */
class InMemoryUserService implements ScimUserService<DemoUser> {
  private seq = 1000;
  private rows: DemoUser[] = [];

  findById = async (id: string): Promise<DemoUser | null> =>
    this.rows.find((u) => u.key === id) ?? null;

  findByUserName = async (userName: string): Promise<DemoUser | null> =>
    this.rows.find((u) => u.userName === userName) ?? null;

  findByExternalId = async (externalId: string): Promise<DemoUser | null> =>
    this.rows.find((u) => u.externalId === externalId) ?? null;

  create = async (user: DemoUser): Promise<DemoUser> => {
    // mapper.fromScim receives NO existing on creates — the service owns
    // id assignment.
    const row = { ...user, key: String(++this.seq), created: new Date(), lastModified: new Date() };
    this.rows.push(row);
    return row;
  };

  update = async (user: DemoUser): Promise<DemoUser> => {
    const existing = this.rows.find((u) => u.key === user.key);
    if (existing === undefined) {
      // Mirrors a real store's happy expectation: the adapter 404s earlier.
      throw new Error(`unexpected missing row ${user.key}`);
    }
    Object.assign(existing, user, { lastModified: new Date() });
    return existing;
  };

  deleteById = async (id: string): Promise<void> => {
    this.rows = this.rows.filter((u) => u.key !== id);
  };

  list = async ({ startIndex, count }: { startIndex: number; count: number }): Promise<Page<DemoUser>> => ({
    totalResults: this.rows.length,
    items: this.rows.slice(startIndex - 1, startIndex - 1 + count),
  });
}

@ScimUserMapperToken()
class ExampleUserMapper implements ScimUserMapper<DemoUser> {
  getId = (domain: DemoUser): string => domain.key;

  fromScim = (scim: ScimUserCreate & { password?: string }, existing?: DemoUser): DemoUser => ({
    key: existing?.key ?? '',
    userName: scim.userName,
    displayName: scim.displayName ?? null, // strict absence ⇒ cleared
    emails: ('emails' in scim ? scim.emails : undefined) as DemoUser['emails'] ?? [],
    externalId: scim.externalId ?? null,
    created: existing?.created ?? new Date(),
    lastModified: existing?.lastModified ?? new Date(),
  });

  toScim = (domain: DemoUser) => ({
    userName: domain.userName,
    displayName: domain.displayName ?? undefined,
    emails: domain.emails.length > 0 ? domain.emails : undefined,
    externalId: domain.externalId ?? undefined,
  });

  getMeta = ({ created, lastModified }: DemoUser) => ({ created, lastModified });
}

export interface E2eApp {
  readonly app: INestApplication;
  readonly adapter: ScimUserAdapter<DemoUser>;
  /** Fully-resting app tear-down, mirrored in afterAll() of specs. */
  close(): Promise<void>;
}

export async function buildScimE2eApp(
  moduleOptions: {
    basePath?: string;
    /** Guards wired onto /Users routes ONLY (discovery stays open). */
    auth?: Type<CanActivate> | Array<Type<CanActivate>>;
    /** Service swap for error-corpus apps (e.g. an exploding SPI). */
    userService?: Type<unknown>;
    /** SPC overrides for e.g. patch-disabled providers (RFC 7643 §5). */
    serviceProviderConfig?: ScimSPCOverrides;
  } = {},
): Promise<E2eApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ScimModule.forRoot({
        basePath: moduleOptions.basePath ?? '/scim/v2',
        userService: moduleOptions.userService ?? InMemoryUserService,
        userMapper: ExampleUserMapper,
        auth: moduleOptions.auth,
        serviceProviderConfig: moduleOptions.serviceProviderConfig,
      }),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    adapter: app.get(ScimUserAdapter) as ScimUserAdapter<DemoUser>,
    close: () => app.close(),
  };
}

/**
 * supertest does not auto-parse non-JSON media types — SCIM responses are
 * `application/scim+json`, so bodies arrive as text and get parsed here.
 */
export function scimBody(response: { text?: string; body?: unknown }): unknown {
  if (response.body !== undefined && response.body !== null && typeof response.body === 'object') {
    return response.body;
  }
  if (typeof response.text !== 'string' || response.text.length === 0) return null;
  return JSON.parse(response.text);
}

export const SCIM_ERROR_URN = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_LIST_URN = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';

const USER_PAYLOAD = {
  schemas: [SCIM_USER_SCHEMA],
  userName: 'bjensen@example.com',
  displayName: 'Babs Jensen',
  emails: [{ value: 'bjensen@example.com', type: 'work', primary: true }],
};

export const e2e = { USER_PAYLOAD };
