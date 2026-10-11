import BaseConvention from './BaseConvention.ts';
import type { RuntimeInflection } from './contracts.ts';

let inflection: RuntimeInflection | undefined;

export function installUnderscoreConventionDependencies(nextInflection: RuntimeInflection): void {
  inflection = nextInflection;
}

export default class UnderscoreConvention extends BaseConvention {
  static override attribute(modelName: string, plural?: boolean): string {
    if (!inflection) throw new Error('UnderscoreConvention dependencies are not installed');
    return inflection[plural ? 'pluralize' : 'singularize'](inflection.underscore(modelName));
  }
}
