import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import neo4j from 'neo4j-driver';
import { Daytona } from '@daytona/sdk';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixture');
const repoName = 'hacksprint-t1-demo';
const changedPath = 'src/permissions.js';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and configure it.`);
  return value;
}

function validateConfig() {
  for (const name of [
    'DAYTONA_API_KEY', 'NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD',
    'NOSANA_BASE_URL', 'NOSANA_API_KEY', 'NOSANA_MODEL'
  ]) required(name);
}

async function fixtureFiles(dir, root = dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) files.push(...await fixtureFiles(full, root));
    else if (item.isFile() && item.name !== 'pr.diff') files.push({
      source: full,
      destination: join('workspace', relative(root, full)).replaceAll('\\', '/')
    });
  }
  return files;
}

async function runDaytona() {
  const daytona = new Daytona({ apiKey: required('DAYTONA_API_KEY') });
  let sandbox;
  try {
    console.log('1/3  Daytona: creating an isolated JavaScript sandbox…');
    sandbox = await daytona.create({
      language: 'javascript',
      autoStopInterval: 10,
      autoDeleteInterval: 30
    });
    await sandbox.fs.createFolder('workspace', '755');
    await sandbox.fs.createFolder('workspace/src', '755');
    await sandbox.fs.createFolder('workspace/test', '755');
    const files = await fixtureFiles(fixtureRoot);
    files.push({
      source: join(fixtureRoot, 'pr.diff'),
      destination: 'workspace/pr.diff'
    });
    await sandbox.fs.uploadFiles(files);
    const result = await sandbox.process.executeCommand(
      'patch -p1 < pr.diff && npm test', 'workspace', {}, 90
    );
    return {
      passed: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.result ?? result.artifacts?.stdout ?? ''
    };
  } finally {
    if (sandbox) await daytona.delete(sandbox).catch(error => {
      console.error(`Sandbox cleanup warning: ${error.message}`);
    });
  }
}

async function runBlastRadius() {
  const driver = neo4j.driver(
    required('NEO4J_URI'),
    neo4j.auth.basic(required('NEO4J_USERNAME'), required('NEO4J_PASSWORD'))
  );
  const database = process.env.NEO4J_DATABASE || 'neo4j';
  try {
    console.log('2/3  Neo4j: tracing transitive dependents in the pre-seeded graph…');
    const session = driver.session({ database });
    try {
      const result = await session.run(`
        MATCH (changed:DemoModule {repo: $repo, path: $changedPath})
        MATCH (consumer:DemoModule {repo: $repo})
        WHERE consumer <> changed
        MATCH path=(consumer)-[:DEPENDS_ON*1..]->(changed)
        RETURN DISTINCT consumer.path AS path, min(length(path)) AS depth
        ORDER BY depth, path
      `, { repo: repoName, changedPath });
      return result.records.map(record => ({
        path: record.get('path'),
        depth: neo4j.integer.toNumber(record.get('depth'))
      }));
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
}

async function runNosana({ test, blastRadius }) {
  const baseUrl = (process.env.NOSANA_BASE_URL || '').replace(/\/$/, '');
  const apiKey = required('NOSANA_API_KEY');
  const model = required('NOSANA_MODEL');
  if (!baseUrl) throw new Error('Missing NOSANA_BASE_URL. Set it to the assigned Nosana inference endpoint.');
  const diff = await readFile(join(fixtureRoot, 'pr.diff'), 'utf8');
  console.log('3/3  Nosana: generating a merge-risk report…');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You review pull-request risk. Use only the supplied diff, test result, and dependency graph. Do not claim checks that were not run. Return a short verdict, evidence, impacted modules, and merge recommendation.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            repository: repoName,
            changedFile: changedPath,
            diff,
            tests: test,
            blastRadius
          })
        }
      ]
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Nosana inference failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload.choices?.[0]?.message?.content ?? JSON.stringify(payload);
}

async function main() {
  validateConfig();
  const test = await runDaytona();
  const blastRadius = await runBlastRadius();
  const report = await runNosana({ test, blastRadius });
  console.log('\n=== PR MERGE RISK REPORT ===');
  console.log(`Sandbox test result: ${test.passed ? 'PASS' : 'FAIL'} (exit ${test.exitCode})`);
  console.log(`Blast radius: ${changedPath}${blastRadius.length ? ` → ${blastRadius.map(x => x.path).join(', ')}` : ' → none'}`);
  console.log('\n' + report + '\n');
  if (!test.passed) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Demo failed: ${error.message}`);
    process.exitCode = 1;
  });
}
