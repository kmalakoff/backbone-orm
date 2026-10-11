import type { SchemaDependencies } from './contracts.ts';

let dependencies: SchemaDependencies | undefined;

export function installSchemaDependencies(value: SchemaDependencies): void {
  dependencies = value;
}

export function getSchemaDependencies(): SchemaDependencies {
  if (!dependencies) throw new Error('Schema dependencies are not installed');
  return dependencies;
}
