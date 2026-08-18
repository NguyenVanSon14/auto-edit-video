const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

let operationQueue = Promise.resolve();

function databasePath() {
  return path.join(config.dataDir, 'video-plans.json');
}

async function readAll() {
  try {
    return JSON.parse(await fs.readFile(databasePath(), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAll(plans) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const target = databasePath();
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(plans, null, 2), 'utf8');
  await fs.rename(temporary, target);
}

function mutate(operation) {
  const result = operationQueue.then(async () => {
    const plans = await readAll();
    const value = await operation(plans);
    await writeAll(plans);
    return value;
  });
  operationQueue = result.catch(() => {});
  return result;
}

async function list() {
  await operationQueue;
  return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function findById(id) {
  await operationQueue;
  return (await readAll()).find((plan) => plan.id === id) || null;
}

async function create(input) {
  return mutate((plans) => {
    const now = new Date().toISOString();
    const plan = {
      id: crypto.randomUUID(),
      ...input,
      status: 'draft',
      progress: 0,
      outputUrl: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    plans.push(plan);
    return plan;
  });
}

async function update(id, patch) {
  return mutate((plans) => {
    const index = plans.findIndex((plan) => plan.id === id);
    if (index < 0) return null;
    plans[index] = { ...plans[index], ...patch, updatedAt: new Date().toISOString() };
    return plans[index];
  });
}

async function remove(id) {
  return mutate((plans) => {
    const index = plans.findIndex((plan) => plan.id === id);
    if (index < 0) return false;
    plans.splice(index, 1);
    return true;
  });
}

module.exports = { list, findById, create, update, remove };
