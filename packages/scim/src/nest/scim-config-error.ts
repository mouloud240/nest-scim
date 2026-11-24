/** Error emitted when `forRoot` / mapper configuration is malformed. */
export class ScimModuleConfigError extends Error {
  constructor(
    public readonly field: string,
    what: string,
  ) {
    super(`ScimModule.forRoot: ${field} must be ${what}.`);
    this.name = 'ScimModuleConfigError';
  }
}
