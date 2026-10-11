import BaseConvention from './BaseConvention.ts';
import type { RuntimeInflection } from './contracts.ts';

let inflection: RuntimeInflection | undefined;

export function installClassifyConventionDependencies(nextInflection: RuntimeInflection): void {
  inflection = nextInflection;
}

export default class ClassifyConvention extends BaseConvention {
  static override attribute(modelName: string, plural?: boolean): string {
    if (!inflection) throw new Error('ClassifyConvention dependencies are not installed');
    return inflection[plural ? 'pluralize' : 'singularize'](inflection.camelize(modelName, false));
  }
}
