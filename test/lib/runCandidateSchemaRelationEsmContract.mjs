import Backbone from 'backbone';

import ORM from '../../dist/esm/index.js';
import observe from './schemaRelationContractScenario.ts';

try {
  process.stdout.write(`${JSON.stringify(await observe(ORM, Backbone, true))}\n`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
