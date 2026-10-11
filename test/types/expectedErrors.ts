import Backbone from 'backbone';
import BackboneORM, { type AdapterSync, type CursorInstance, configureModel, type ORMModelConstructor, type PatchRemove, type PatchRemoveModelConstructor, type Relation } from 'backbone-orm';
import type { CursorCallback, IterationCallback, IterationIterator } from 'backbone-orm';
import type { IntervalIterator, IntervalQuery, IterationInfo } from 'backbone-orm';
import type { FindOneNearestDateOptions } from 'backbone-orm';

interface AuthorAttributes {
  name: string;
}

type Author = Backbone.Model<AuthorAttributes>;

declare const Author: ORMModelConstructor<Author>;

// @ts-expect-error Find queries reject keys outside the concrete attributes.
Author.find({ title: 'Notes' });
// @ts-expect-error Find queries retain each concrete attribute value type.
Author.find({ name: 42 });
// @ts-expect-error Callback overloads return void.
const callbackPromise: Promise<Author[]> = Author.find(() => undefined);

// @ts-expect-error Schema override flags retain their declared types.
new BackboneORM.Schema(Author, { id: { manual: 'yes' } });
declare const relation: Relation;
// @ts-expect-error Public relation objects do not expose internal persistence methods.
relation.patchAdd(new Backbone.Model(), 1, () => undefined);
// @ts-expect-error Relation types are the three supported normalized values.
relation.type = 'manyToMany';

class PlainModel extends Backbone.Model<{ label: string }> {}
// @ts-expect-error Unconfigured Backbone constructors do not declare ORM find.
PlainModel.find();

const ConfiguredPlainModel = configureModel(PlainModel);
// @ts-expect-error Configuration narrows the returned constructor, not the original class binding.
PlainModel.find();
// @ts-expect-error Native configured results retain their concrete model type.
const wrongNativeResult: Promise<Author[]> = ConfiguredPlainModel.find();
// @ts-expect-error Cache-wrapped resetSchema has an implementation-defined synchronous return, not a void contract.
const resetSchemaVoid: void = ConfiguredPlainModel.resetSchema({}, () => undefined);

void callbackPromise;
void [wrongNativeResult, resetSchemaVoid];

interface OwnedConnection {
  close(callback: (error?: Error | null) => void): void;
}

// @ts-expect-error General pool reads stay unknown until the adapter checks the stored value.
const uncheckedOwnedConnection: OwnedConnection | undefined = BackboneORM.ConnectionPool.get('typed-connection');
// @ts-expect-error Pool reads do not accept an arbitrary caller-selected result type.
BackboneORM.ConnectionPool.get<OwnedConnection>('typed-connection');
// @ts-expect-error Callback disposal returns void rather than a Promise facade.
const callbackDisposalPromise: Promise<void> = BackboneORM.ConnectionPool.dispose('typed-connection', () => undefined);

void uncheckedOwnedConnection;
void callbackDisposalPromise;

// @ts-expect-error Calling value without an argument returns undefined, not a generator.
const missingValueGenerator: () => unknown = BackboneORM.Fabricator.value();
// @ts-expect-error Calling uniqueId without a prefix returns the id immediately.
const immediateIdGenerator: () => string = BackboneORM.Fabricator.uniqueId();
// @ts-expect-error The one-argument date overload accepts a millisecond step, not a start date.
BackboneORM.Fabricator.date(new Date());
// @ts-expect-error Fabricated attributes retain the configured model attribute types.
BackboneORM.Fabricator.new(Author, 1, { name: 42 });
// @ts-expect-error Fabricator.create remains callback-only and requires its completion callback.
BackboneORM.Fabricator.create(Author, 1, { name: 'missing callback' });
// @ts-expect-error TestUtils tag filters are strings.
const numericOptionTags: number = BackboneORM.TestUtils.optionSets()[0].$tags;
type Handler = () => string;
class HandlerModel extends Backbone.Model<{ handler: Handler }> {}
declare const handler: Handler;
// @ts-expect-error Callable attributes must be wrapped in a generator because Fabricator invokes every function value.
BackboneORM.Fabricator.new(HandlerModel, 1, { handler });
class RequiredExtraArgumentModel extends Backbone.Model<{ name: string }> {
  constructor(attributes: { name: string }, requiredToken: string) {
    super(attributes);
    void requiredToken;
  }
}
// @ts-expect-error Fabricator supplies only the attributes constructor argument.
BackboneORM.Fabricator.new(RequiredExtraArgumentModel, 1, { name: 'extra argument' });
// @ts-expect-error Fabricator.create also supplies only the attributes constructor argument.
BackboneORM.Fabricator.create(RequiredExtraArgumentModel, 1, { name: 'extra argument' }, () => undefined);
class RequiredAttributesModel extends Backbone.Model<{ name: string }> {
  constructor(attributes: { name: string }) {
    super(attributes);
  }
}
// @ts-expect-error A constructor requiring name cannot be fabricated from an empty attribute specification.
const falselySafeRequiredModels: RequiredAttributesModel[] = BackboneORM.Fabricator.new(RequiredAttributesModel, 1, {});
// @ts-expect-error The same required-attribute boundary applies to Fabricator.create.
BackboneORM.Fabricator.create(RequiredAttributesModel, 1, {}, () => undefined);

void [missingValueGenerator, immediateIdGenerator, numericOptionTags, falselySafeRequiredModels];

declare const adapterSync: AdapterSync<CursorInstance>;
// @ts-expect-error Existing control dispatch remains callback-only and does not promise a request result.
const destroyPromise: Promise<void> = adapterSync('destroy', {}, () => undefined);
declare const patchModelType: PatchRemoveModelConstructor;
const patchRemove: PatchRemove = BackboneORM.Utils.patchRemove;
// @ts-expect-error patchRemove remains callback-only and its underlying Queue return is not a Promise contract.
const patchPromise: Promise<void> = patchRemove(patchModelType, new Backbone.Model(), () => undefined);
const adapterCursor = adapterSync('cursor', {});
// @ts-expect-error The owned cursor API requires its established callback and does not add a Promise facade.
const cursorPromise: Promise<unknown> = adapterCursor.toJSON(() => undefined);

void [destroyPromise, patchPromise, cursorPromise];

class ExistingFindModel extends Backbone.Model<{ label: string }> {
  static find(): string {
    return 'custom';
  }
}

const ConfiguredExistingFindModel = configureModel(ExistingFindModel);
// @ts-expect-error Configuration replaces an incompatible existing static find return.
const replacedFindString: string = ConfiguredExistingFindModel.find();
// @ts-expect-error The configured find result is a Promise, not the previous string.
ConfiguredExistingFindModel.find().toUpperCase();

class InheritedConfiguredModel extends ConfiguredExistingFindModel {}
const ConfiguredInheritedModel = configureModel(InheritedConfiguredModel);
// @ts-expect-error Reconfiguration of an inherited facade still returns concrete models in a Promise.
const inheritedFindString: string = ConfiguredInheritedModel.find();

void replacedFindString;
void inheritedFindString;

const relatedModel = new ConfiguredPlainModel({ label: 'relations' });
// @ts-expect-error fetchRelated requires a callback and has no Promise-only form.
relatedModel.fetchRelated();
// @ts-expect-error A single relation selector still requires its callback.
relatedModel.fetchRelated('children');
// @ts-expect-error Multiple relation selectors still require their callback.
relatedModel.fetchRelated(['children']);
// @ts-expect-error Relation selectors must be strings or arrays of strings.
relatedModel.fetchRelated(42, () => undefined);
// @ts-expect-error Every relation selector in an array must be a string.
relatedModel.fetchRelated(['children', 42], () => undefined);
// @ts-expect-error Completion callbacks receive an optional error, not a model result.
relatedModel.fetchRelated((error: string) => error);
// @ts-expect-error Callback completion does not promise a Promise return.
const relatedPromise: Promise<void> = relatedModel.fetchRelated(() => undefined);
// @ts-expect-error Queue callback returns remain unknown rather than void.
const relatedVoid: void = relatedModel.fetchRelated('children', () => undefined);
// @ts-expect-error An unchecked fetchRelated result has no declared Promise methods.
relatedModel.fetchRelated(['children'], () => undefined).then(() => undefined);
// @ts-expect-error The configured instance retains its concrete attribute types.
const wrongRelatedLabel: number = relatedModel.get('label');
// @ts-expect-error The configured constructor retains required extra arguments.
new (configureModel(RequiredExtraArgumentModel))({ name: 'missing token' });
// @ts-expect-error Configuration augments its return without changing the original instance declaration.
new PlainModel().fetchRelated(() => undefined);

void [relatedPromise, relatedVoid, wrongRelatedLabel];

class CursorShapeModel extends Backbone.Model<{ label: string }> {}
const cursorShapeSync = new BackboneORM.sync.Sync(CursorShapeModel);
cursorShapeSync.cursor({}).toJSON((_error, result) => {
  // @ts-expect-error An unresolved cursor query does not promise an array.
  const rows: Array<Record<string, unknown>> = result;
  void rows;
});

// @ts-expect-error Load-state queries accept string keys only.
relatedModel.isLoaded(42);
// @ts-expect-error Load-state queries do not take a completion callback.
relatedModel.isLoaded('children', () => undefined);
// @ts-expect-error Model load-state setters require a boolean.
relatedModel.setLoaded();
// @ts-expect-error A relation key alone is not a model load-state boolean.
relatedModel.setLoaded('children');
// @ts-expect-error Model load state cannot be a string.
relatedModel.setLoaded('true');
// @ts-expect-error A relation key must be a string.
relatedModel.setLoaded(42, true);
// @ts-expect-error A keyed setter requires a boolean state.
relatedModel.setLoaded('children', 'true');
// @ts-expect-error A keyed setter requires its state argument.
relatedModel.setLoaded('children', undefined);
// @ts-expect-error A setter takes no completion callback.
relatedModel.setLoaded('children', true, () => undefined);
// @ts-expect-error Setter completion can be undefined, so it is not always boolean.
const loadStateBoolean: boolean = relatedModel.setLoaded(true);
// @ts-expect-error A pending flag can be returned, so the result is not always undefined.
const loadStateUndefined: undefined = relatedModel.setLoaded('children', false);
// @ts-expect-error The synchronous setter is not fluent.
const fluentLoadState: typeof relatedModel = relatedModel.setLoaded(false);
// @ts-expect-error Load-state queries return booleans, not Promises.
const loadStatePromise: Promise<boolean> = relatedModel.isLoaded();
// @ts-expect-error Synchronous setter results have no Promise methods.
relatedModel.setLoaded(true).then(() => undefined);
// @ts-expect-error Unconfigured instance declarations do not gain load-state methods.
new PlainModel().isLoaded();
// @ts-expect-error Configuration augments its returned instance declaration only.
new PlainModel().setLoaded(true);

void [loadStateBoolean, loadStateUndefined, fluentLoadState, loadStatePromise];

// @ts-expect-error MemoryStore options must be a record, null or undefined.
new BackboneORM.MemoryStore(42);
// @ts-expect-error MemoryStore takes at most one options argument.
new BackboneORM.MemoryStore({}, {});
const memoryStore = new BackboneORM.MemoryStore();
// @ts-expect-error Stored values must satisfy the existing cache-value shape.
memoryStore.set('typed-cache', 42);
// @ts-expect-error The cache exclusion flag is boolean.
memoryStore.set('typed-cache', { _orm_never_cache: 'yes' });
// @ts-expect-error Set completion supplies null as its error argument.
memoryStore.set('typed-cache', {}, (error: string) => error);
// @ts-expect-error Set completion does not promise caller-selected value fields.
memoryStore.set('typed-cache', {}, (_error, value: { label: string }) => value.label);
// @ts-expect-error Get completion supplies null as its error argument.
memoryStore.get('typed-cache', (error: Error) => error);
// @ts-expect-error Get completion values remain unknown until narrowed.
memoryStore.get('typed-cache', (_error, value: string) => value.toUpperCase());
// @ts-expect-error Destroy completion takes no arguments.
memoryStore.destroy('typed-cache', (error: Error) => error);
// @ts-expect-error Reset completion must be a function.
memoryStore.reset(true);
// @ts-expect-error forEach requires its iterator.
memoryStore.forEach();
// @ts-expect-error Iteration does not promise a concrete stored-value type.
memoryStore.forEach((value: string) => value.toUpperCase());
// @ts-expect-error An unchecked read is not a string.
const concreteMemoryStoreRead: string = memoryStore.get('typed-cache');
// @ts-expect-error Get has no caller-selected generic result type.
memoryStore.get<string>('typed-cache');
// @ts-expect-error Never-cache completion can return a truthy callback result rather than the store.
const fluentMemoryStoreSet: typeof memoryStore = memoryStore.set('uncached', { _orm_never_cache: true }, () => 'not-stored');
// @ts-expect-error Destroy returns the store synchronously, not a Promise.
const memoryStoreDestroyPromise: Promise<void> = memoryStore.destroy('typed-cache');

void [concreteMemoryStoreRead, fluentMemoryStoreSet, memoryStoreDestroyPromise];

const eachModelIterator: IterationIterator<PlainModel> = (model, next) => {
  next();
  return model;
};
const eachCompletion: CursorCallback<number> = (error, count) => [error, count];
// @ts-expect-error The original constructor has not acquired configured statics.
PlainModel.each(eachModelIterator, eachCompletion);
// @ts-expect-error each requires an iterator and completion callback.
ConfiguredPlainModel.each();
// @ts-expect-error each requires the final completion callback.
ConfiguredPlainModel.each(eachModelIterator);
// @ts-expect-error Query calls require their completion callback.
ConfiguredPlainModel.each({ $each: { json: false } }, eachModelIterator);
// @ts-expect-error eachC requires its iterator after completion.
ConfiguredPlainModel.eachC(eachCompletion);
// @ts-expect-error Query eachC calls require the third iterator argument.
ConfiguredPlainModel.eachC({ $each: { json: false } }, eachCompletion);
// @ts-expect-error Model-mode iteration supplies a model, not a number.
ConfiguredPlainModel.each((value: number, next: IterationCallback) => next(), eachCompletion);
ConfiguredPlainModel.each((model, next) => {
  // @ts-expect-error The concrete model's label attribute is a string.
  const numericLabel: number = model.get('label');
  next();
  return numericLabel;
}, eachCompletion);
ConfiguredPlainModel.each({ $each: { json: true } }, (value, next) => {
  // @ts-expect-error JSON selection does not supply a Backbone model.
  const model: PlainModel = value;
  // @ts-expect-error JSON/projection output does not promise a concrete object shape.
  const json: { label: string } = value;
  next();
  return [model, json];
}, eachCompletion);
declare const eachJsonMode: boolean;
ConfiguredPlainModel.each({ $each: { json: eachJsonMode } }, (value, next) => {
  // @ts-expect-error A dynamic selector does not prove model output.
  const model: PlainModel = value;
  next();
  return model;
}, eachCompletion);
declare const eachQuery: Record<string, unknown>;
ConfiguredPlainModel.eachC(eachQuery, eachCompletion, (value, next) => {
  // @ts-expect-error A broad query does not prove model output.
  const model: PlainModel = value;
  next();
  return model;
});
// @ts-expect-error The owner's fetch option is numeric.
ConfiguredPlainModel.each({ $each: { fetch: '200' } }, (value: unknown, next: IterationCallback) => next(), eachCompletion);
// @ts-expect-error The owner's threads option is numeric.
ConfiguredPlainModel.each({ $each: { threads: '1' } }, (value: unknown, next: IterationCallback) => next(), eachCompletion);
// @ts-expect-error The owner's json option is boolean.
ConfiguredPlainModel.eachC({ $each: { json: 'true' } }, eachCompletion, (value: unknown, next: IterationCallback) => next());
// @ts-expect-error Completion receives an optional number count, not a string.
ConfiguredPlainModel.each(eachModelIterator, (_error: Error | null, count: string) => count);
ConfiguredPlainModel.each((model, next) => {
  // @ts-expect-error Iterator continuation accepts an Error, null or undefined.
  next('failed');
  return model;
}, eachCompletion);
// @ts-expect-error eachC takes completion before the explicitly typed iterator.
ConfiguredPlainModel.eachC(eachModelIterator, eachCompletion);
// @ts-expect-error Query eachC preserves completion-before-iterator order.
ConfiguredPlainModel.eachC({ $each: { json: false } }, eachModelIterator, eachCompletion);
// @ts-expect-error Synchronous each return is unknown, not guaranteed void.
const eachVoid: void = ConfiguredPlainModel.each(eachModelIterator, eachCompletion);
// @ts-expect-error each does not promise an asynchronous return value.
const eachPromise: Promise<number> = ConfiguredPlainModel.each(eachModelIterator, eachCompletion);
// @ts-expect-error The unchecked synchronous eachC return has no promised then method.
ConfiguredPlainModel.eachC(eachCompletion, eachModelIterator).then(() => undefined);

class ExistingEachModel extends PlainModel {
  static each(): string {
    return 'custom-each';
  }

  static eachC(): string {
    return 'custom-eachC';
  }
}

const ConfiguredExistingEachModel = configureModel(ExistingEachModel);
// @ts-expect-error Configuration replaces the original zero-argument static each.
const originalEachString: string = ConfiguredExistingEachModel.each();
// @ts-expect-error The configured static each return is unknown despite the original signature.
const configuredEachString: string = ConfiguredExistingEachModel.each(eachModelIterator, eachCompletion);
// @ts-expect-error The configured static eachC return is unknown despite the original signature.
const configuredEachCString: string = ConfiguredExistingEachModel.eachC(eachCompletion, eachModelIterator);

void [eachVoid, eachPromise, originalEachString, configuredEachString, configuredEachCString];

const intervalQuery: IntervalQuery = { status: 'completed', $interval: { key: 'created_at', type: 'days' } };
const intervalIterator: IntervalIterator = (query, information, next) => {
  next();
  return [query, information];
};
const intervalCompletion: IterationCallback = (error) => error;
// @ts-expect-error The original constructor has not acquired interval statics.
PlainModel.interval(intervalQuery, intervalIterator, intervalCompletion);
// @ts-expect-error interval requires query, iterator and completion.
ConfiguredPlainModel.interval();
// @ts-expect-error interval requires an explicit query before its iterator.
ConfiguredPlainModel.interval(intervalIterator, intervalCompletion);
// @ts-expect-error interval requires its final completion callback.
ConfiguredPlainModel.interval(intervalQuery, intervalIterator);
// @ts-expect-error intervalC requires its iterator as the third argument.
ConfiguredPlainModel.intervalC(intervalQuery, intervalCompletion);
// @ts-expect-error The public query requires interval options.
ConfiguredPlainModel.interval({}, intervalIterator, intervalCompletion);
// @ts-expect-error Interval options require both key and type.
ConfiguredPlainModel.interval({ $interval: {} }, intervalIterator, intervalCompletion);
// @ts-expect-error Interval key is required.
ConfiguredPlainModel.interval({ $interval: { type: 'days' } }, intervalIterator, intervalCompletion);
// @ts-expect-error Interval type is required.
ConfiguredPlainModel.intervalC({ $interval: { key: 'created_at' } }, intervalCompletion, intervalIterator);
// @ts-expect-error Interval key must be a string.
ConfiguredPlainModel.interval({ $interval: { key: 42, type: 'days' } }, intervalIterator, intervalCompletion);
// @ts-expect-error Singular day is outside the supported DurationUnit contract.
ConfiguredPlainModel.interval({ $interval: { key: 'created_at', type: 'day' } }, intervalIterator, intervalCompletion);
declare const intervalUnit: string;
// @ts-expect-error A broad string does not establish a supported duration unit.
ConfiguredPlainModel.intervalC({ $interval: { key: 'created_at', type: intervalUnit } }, intervalCompletion, intervalIterator);
// @ts-expect-error Interval length must be numeric.
ConfiguredPlainModel.interval({ $interval: { key: 'created_at', type: 'days', length: '2' } }, intervalIterator, intervalCompletion);
// @ts-expect-error The owner's lower date bound requires a Date.
ConfiguredPlainModel.interval({ $interval: { key: 'created_at', type: 'days', range: { $gte: '2020-01-01' } } }, intervalIterator, intervalCompletion);
// @ts-expect-error The owner's upper date bound requires a Date.
ConfiguredPlainModel.interval({ $interval: { key: 'created_at', type: 'days', range: { $lt: 42 } } }, intervalIterator, intervalCompletion);
// @ts-expect-error The owner's range start requires a Date.
ConfiguredPlainModel.interval({ $interval: { key: 'created_at', type: 'days', range: { start: '2020-01-01' } } }, intervalIterator, intervalCompletion);
// @ts-expect-error The owner's range end requires a Date.
ConfiguredPlainModel.intervalC({ $interval: { key: 'created_at', type: 'days', range: { end: 42 } } }, intervalCompletion, intervalIterator);
// @ts-expect-error Interval iteration receives a query record, not a model.
ConfiguredPlainModel.interval(intervalQuery, (model: PlainModel, information: IterationInfo, next: IterationCallback) => next(), intervalCompletion);
ConfiguredPlainModel.interval(intervalQuery, (query, information, next) => {
  // @ts-expect-error The interval query is not a Backbone model.
  const model: PlainModel = query;
  // @ts-expect-error Query filter values remain unknown until narrowed.
  const label: string = query.label;
  // @ts-expect-error The owner's start date remains optional.
  const start: Date = information.start;
  // @ts-expect-error The owner's interval index remains optional.
  const index: number = information.index;
  // @ts-expect-error Interval index must be numeric when supplied.
  information.index = 'first';
  // @ts-expect-error Continuation accepts Error, null or undefined.
  next('failed');
  return [model, label, start, index];
}, intervalCompletion);
// @ts-expect-error Completion receives only its optional error, not a required count.
ConfiguredPlainModel.interval(intervalQuery, intervalIterator, (_error: Error | null | undefined, count: number) => count);
// @ts-expect-error interval takes the explicitly typed iterator before completion.
ConfiguredPlainModel.interval(intervalQuery, intervalCompletion, intervalIterator);
// @ts-expect-error intervalC takes completion before the explicitly typed iterator.
ConfiguredPlainModel.intervalC(intervalQuery, intervalIterator, intervalCompletion);
// @ts-expect-error Synchronous interval return is unknown, not guaranteed void.
const intervalVoid: void = ConfiguredPlainModel.interval(intervalQuery, intervalIterator, intervalCompletion);
// @ts-expect-error interval has no Promise return contract.
const intervalPromise: Promise<void> = ConfiguredPlainModel.interval(intervalQuery, intervalIterator, intervalCompletion);
// @ts-expect-error The unchecked intervalC return has no promised then method.
ConfiguredPlainModel.intervalC(intervalQuery, intervalCompletion, intervalIterator).then(() => undefined);

class ExistingIntervalModel extends PlainModel {
  static interval(): string {
    return 'custom-interval';
  }

  static intervalC(): string {
    return 'custom-intervalC';
  }
}

const ConfiguredExistingIntervalModel = configureModel(ExistingIntervalModel);
// @ts-expect-error Configuration replaces the original zero-argument static interval.
const originalIntervalString: string = ConfiguredExistingIntervalModel.interval();
// @ts-expect-error Configuration replaces the original zero-argument static intervalC.
const originalIntervalCString: string = ConfiguredExistingIntervalModel.intervalC();
// @ts-expect-error Configured interval return is unknown despite the original signature.
const configuredIntervalString: string = ConfiguredExistingIntervalModel.interval(intervalQuery, intervalIterator, intervalCompletion);
// @ts-expect-error Configured intervalC return is unknown despite the original signature.
const configuredIntervalCString: string = ConfiguredExistingIntervalModel.intervalC(intervalQuery, intervalCompletion, intervalIterator);

void [intervalVoid, intervalPromise, originalIntervalString, originalIntervalCString, configuredIntervalString, configuredIntervalCString];

const nearestDate = new Date('2020-01-01T00:00:00Z');
const nearestDateOptions: FindOneNearestDateOptions = { key: 'created_at' };
const nearestDateCompletion: CursorCallback<PlainModel | null> = (error, model) => [error, model];
// @ts-expect-error The original constructor has not acquired the ORM static.
PlainModel.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateCompletion);
// @ts-expect-error The public helper requires date, keyed options and a callback.
ConfiguredPlainModel.findOneNearestDate();
// @ts-expect-error The broken two-argument runtime branch is not a public overload.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateCompletion);
// @ts-expect-error Options without a completion callback are insufficient.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions);
// @ts-expect-error The search date requires a Date rather than a date string.
ConfiguredPlainModel.findOneNearestDate('2020-01-01', nearestDateOptions, nearestDateCompletion);
// @ts-expect-error A timestamp number is not the required Date.
ConfiguredPlainModel.findOneNearestDate(42, nearestDateOptions, {}, nearestDateCompletion);
// @ts-expect-error The options key is required.
ConfiguredPlainModel.findOneNearestDate(nearestDate, {}, nearestDateCompletion);
// @ts-expect-error The options key must be a string.
ConfiguredPlainModel.findOneNearestDate(nearestDate, { key: 42 }, nearestDateCompletion);
// @ts-expect-error The fourth-argument form requires a record query.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, 'all', nearestDateCompletion);
// @ts-expect-error An array is not the required query record.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, [], nearestDateCompletion);
// @ts-expect-error A supplied query still requires the final completion callback.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, { label: 'Ada' });
// @ts-expect-error The callback follows the query in the four-argument form.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateCompletion, {});
// @ts-expect-error Completion receives a model rather than a JSON record.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, (_error: Error | null, model?: { label: string } | null) => model);
// @ts-expect-error Completion can omit its result or report no matching model.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, (_error: Error | null, model: PlainModel) => model);
// @ts-expect-error Completion errors are Error or null rather than strings.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, (error: string, model?: PlainModel | null) => [error, model]);
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, {}, (error, model) => {
  // @ts-expect-error Results require a null/undefined check before using the model.
  const requiredModel: PlainModel = model;
  // @ts-expect-error The concrete model attributes are retained.
  const wrongAttribute: number | undefined = model?.get('label');
  return [error, requiredModel, wrongAttribute];
});
// @ts-expect-error The synchronous request return is unknown rather than void.
const nearestDateVoid: void = ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateCompletion);
// @ts-expect-error The helper does not return a Promise contract.
const nearestDatePromise: Promise<PlainModel | null> = ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, {}, nearestDateCompletion);
// @ts-expect-error The unchecked synchronous return has no promised then method.
ConfiguredPlainModel.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateCompletion).then(() => undefined);

class ExistingNearestDateModel extends PlainModel {
  static findOneNearestDate(): string {
    return 'custom-nearest-date';
  }
}

const ConfiguredExistingNearestDateModel = configureModel(ExistingNearestDateModel);
// @ts-expect-error Configuration replaces the original zero-argument signature.
const originalNearestDateString: string = ConfiguredExistingNearestDateModel.findOneNearestDate();
// @ts-expect-error The configured synchronous return remains unknown despite the original signature.
const configuredNearestDateString: string = ConfiguredExistingNearestDateModel.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateCompletion);
// @ts-expect-error The configured query overload also replaces the original return contract.
const configuredNearestDateQueryString: string = ConfiguredExistingNearestDateModel.findOneNearestDate(nearestDate, nearestDateOptions, {}, nearestDateCompletion);

void [nearestDateVoid, nearestDatePromise, originalNearestDateString, configuredNearestDateString, configuredNearestDateQueryString];
