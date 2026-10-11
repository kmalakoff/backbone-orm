export interface RuntimeInflection {
  camelize(value: string, lowFirstLetter?: boolean): string;
  classify(value: string): string;
  pluralize(value: string): string;
  singularize(value: string): string;
  underscore(value: string): string;
}

export interface NamingConvention {
  attribute(modelName: string, plural?: boolean): string;
  foreignKey(modelName: string, plural?: boolean): string;
  modelName(tableName: string, plural?: boolean): string;
  tableName(modelName: string): string;
}

export interface NamingConventionConstructor extends NamingConvention {
  new (): object;
}
