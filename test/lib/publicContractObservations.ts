import observeCursorContract from './cursorContractScenario.ts';
import observeRelationOperations from './relationOperationsScenario.ts';
import observeSchemaRelationContract from './schemaRelationContractScenario.ts';

type Dynamic = any;
type Observation = Record<string, unknown>;

let cursorObservation: Promise<Observation> | undefined;
let relationObservation: Promise<Observation> | undefined;
let schemaObservation: Promise<Observation> | undefined;

export function observePublishedCursorContract(ORM: Dynamic, Backbone: Dynamic): Promise<Observation> {
  return (cursorObservation ??= observeCursorContract(ORM, Backbone));
}

export function observePublishedRelationOperations(ORM: Dynamic, Backbone: Dynamic): Promise<Observation> {
  return (relationObservation ??= observeRelationOperations(ORM, Backbone));
}

export function observePublishedSchemaRelationContract(ORM: Dynamic, Backbone: Dynamic): Promise<Observation> {
  return (schemaObservation ??= observeSchemaRelationContract(ORM, Backbone, true));
}
