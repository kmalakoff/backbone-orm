import getNodeRuntime from './getNodeRuntime.ts';

const BackboneORM = getNodeRuntime();

export const configureModel = BackboneORM.configureModel;
export default BackboneORM;
export * from './types.ts';
