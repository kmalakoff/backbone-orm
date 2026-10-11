type Dynamic = any;
type Loader = () => Dynamic | Promise<Dynamic>;

export default async function observePreconfiguredDatabaseFoundation(
  retained: Dynamic,
  loadCommonJS: Loader,
  loadESM: Loader,
  mode: 'camelize' | 'custom'
): Promise<Record<string, unknown>> {
  const marker = { mode };
  if (mode === 'custom') {
    class CustomConvention extends retained.BaseConvention {
      static modelName(tableName: string, plural?: boolean): string {
        return `CUSTOM_${super.modelName(tableName, plural)}`;
      }
    }
    retained.configure({ naming_conventions: CustomConvention, preinstall_marker: marker });
  } else {
    retained.configure({ naming_conventions: 'camelize', preinstall_marker: marker });
  }

  const convention = retained.naming_conventions;
  const liveURL = new retained.DatabaseURL('memory://host/database/line_items');
  const before = {
    attribute: convention.attribute('LineItem'),
    liveModelName: liveURL.modelName(),
  };
  const commonJS = await loadCommonJS();
  const esm = await loadESM();

  const observe = (runtime: Dynamic) => ({
    attribute: runtime.naming_conventions.attribute('LineItem'),
    liveModelName: liveURL.modelName(),
    markerPreserved: runtime.preinstall_marker === marker,
    namingPreserved: runtime.naming_conventions === convention,
    newModelName: new runtime.DatabaseURL('memory://host/database/line_items').modelName(),
    runtimePreserved: runtime === retained,
  });

  return {
    before,
    commonJS: observe(commonJS),
    esm: observe(esm),
    runtimesShared: commonJS === esm,
  };
}
