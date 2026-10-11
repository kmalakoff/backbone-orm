import type { NamingConventionConstructor, RuntimeInflection } from './contracts.ts';

let inflection: RuntimeInflection | undefined;

export function installConventionDependencies(nextInflection: RuntimeInflection): void {
  inflection = nextInflection;
}

function getInflection(): RuntimeInflection {
  if (!inflection) throw new Error('Naming convention dependencies are not installed');
  return inflection;
}

const BaseConvention = Object.assign(function BaseConvention(): void {}, {
  modelName(tableName: string, plural?: boolean): string {
    const inflect = getInflection();
    return inflect[plural ? 'pluralize' : 'singularize'](inflect.classify(tableName));
  },

  tableName(modelName: string): string {
    const inflect = getInflection();
    return inflect.pluralize(inflect.underscore(modelName));
  },

  foreignKey(modelName: string, plural?: boolean): string {
    const inflect = getInflection();
    if (plural) return `${inflect.singularize(inflect.underscore(modelName))}_ids`;
    return `${inflect.underscore(modelName)}_id`;
  },

  attribute(modelName: string, plural?: boolean): string {
    const inflect = getInflection();
    return inflect[plural ? 'pluralize' : 'singularize'](inflect.underscore(modelName));
  },
}) as unknown as NamingConventionConstructor;

export default BaseConvention;
