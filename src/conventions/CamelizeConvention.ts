import BaseConvention from './BaseConvention.ts';
import type { RuntimeInflection } from './contracts.ts';

let inflection: RuntimeInflection | undefined;

export function installCamelizeConventionDependencies(nextInflection: RuntimeInflection): void {
  inflection = nextInflection;
}

export default class CamelizeConvention extends BaseConvention {
  static override attribute(modelName: string, plural?: boolean): string {
    if (!inflection) throw new Error('CamelizeConvention dependencies are not installed');
    return inflection[plural ? 'pluralize' : 'singularize'](inflection.camelize(modelName, true));
  }
}
