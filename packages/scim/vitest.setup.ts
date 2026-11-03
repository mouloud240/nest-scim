/**
 * reflect-metadata MUST load before anything touching decorators —
 * NestJS's DI and this library's both rely on the polyfill. Standalone
 * production apps load it through @nestjs/core's own side-effect import;
 * vitest replicates that ordering here.
 */
import 'reflect-metadata';
