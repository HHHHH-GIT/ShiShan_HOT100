'use strict';
const WINDOWS = ['today', 'month', 'allTime'];
const COMPONENTS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
const dictionary = () => Object.create(null);
const emptyComponents = () => Object.fromEntries(COMPONENTS.map(key => [key, 0]));
const tokenCount = components => COMPONENTS.reduce((sum, key) => sum + (components[key] || 0), 0);
function addComponents(target, source) {
  for (const key of COMPONENTS) target[key] += source[key] || 0;
}
function emptyPeriod() {
  return {
    totalTokens: 0, ...emptyComponents(), clients: dictionary(), models: dictionary(),
    clientComponents: dictionary(), modelComponents: dictionary(), clientModelComponents: dictionary(),
  };
}
function addClient(target, client, models) {
  target.clients[client] ??= 0;
  target.clientComponents[client] ??= emptyComponents();
  target.clientModelComponents[client] ??= dictionary();
  for (const [model, components] of Object.entries(models)) {
    const tokens = tokenCount(components);
    target.totalTokens += tokens;
    target.clients[client] += tokens;
    target.models[model] = (target.models[model] || 0) + tokens;
    addComponents(target, components);
    addComponents(target.clientComponents[client], components);
    target.modelComponents[model] ??= emptyComponents();
    addComponents(target.modelComponents[model], components);
    target.clientModelComponents[client][model] ??= emptyComponents();
    addComponents(target.clientModelComponents[client][model], components);
  }
}
function normalizePeriod(raw) {
  const period = emptyPeriod();
  for (const [client, models] of Object.entries(raw?.clientModelComponents || {})) addClient(period, client, models);
  return period;
}
function addPeriodInto(target, source) {
  target.totalTokens += source.totalTokens;
  addComponents(target, source);
  for (const key of ['clients', 'models']) {
    for (const [name, tokens] of Object.entries(source[key])) target[key][name] = (target[key][name] || 0) + tokens;
  }
  for (const key of ['clientComponents', 'modelComponents']) {
    for (const [name, components] of Object.entries(source[key])) {
      target[key][name] ??= emptyComponents();
      addComponents(target[key][name], components);
    }
  }
  for (const [client, models] of Object.entries(source.clientModelComponents)) {
    target.clientModelComponents[client] ??= dictionary();
    for (const [model, components] of Object.entries(models)) {
      target.clientModelComponents[client][model] ??= emptyComponents();
      addComponents(target.clientModelComponents[client][model], components);
    }
  }
}
module.exports = { WINDOWS, COMPONENTS, emptyPeriod, emptyComponents, tokenCount, addComponents, addClient, normalizePeriod, addPeriodInto };
