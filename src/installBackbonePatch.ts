import type Backbone from 'backbone';

interface CollectionWithRemoval {
  _byId: Record<PropertyKey, Backbone.Model>;
  _removeModels(models: unknown[], options: Backbone.Silenceable): Backbone.Model[] | false;
  _removeReference(model: Backbone.Model, options: Backbone.Silenceable): void;
  get(value: unknown): Backbone.Model | undefined;
  indexOf(model: Backbone.Model): number;
  length: number;
  models: Backbone.Model[];
  modelId(attributes: Backbone.ObjectHash): unknown;
}

export default function installBackbonePatch(BackboneRuntime: typeof Backbone): void {
  const version = Reflect.get(BackboneRuntime, 'VERSION') as string;
  const [major, minor] = version.split('.');
  if (!(Number(major) >= 1 && Number(minor) >= 2)) return;

  const prototype = BackboneRuntime.Collection.prototype as unknown as CollectionWithRemoval;
  prototype._removeModels = function removeModels(models, options) {
    const removed: Backbone.Model[] = [];
    for (const input of models) {
      const model = this.get(input);
      if (!model) continue;

      const id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id as PropertyKey];
      delete this._byId[model.cid];

      const index = this.indexOf(model);
      this.models.splice(index, 1);
      this.length -= 1;

      if (!options.silent) {
        Reflect.set(options, 'index', index);
        model.trigger('remove', model, this, options);
      }

      removed.push(model);
      this._removeReference(model, options);
    }
    return removed.length ? removed : false;
  };
}
