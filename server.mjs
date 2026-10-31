import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = await readFile(join(here, 'public', 'index.html'));
const host = process.env.DEMO_HOST || '127.0.0.1';
const port = Number(process.env.DEMO_PORT || 4173);
let isRunning = false;

function respond(res, status, value, type = 'application/json; charset=utf-8') {
  const body = type.startsWith('application/json') ? JSON.stringify(value) : value;
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function runConsoleDemo() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'demo.mjs'], {
      cwd: here,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const limit = 1024 * 1024;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout = (stdout + chunk).slice(-limit);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-limit);
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code }));
  });
}

function summarizeRun(run) {
  const allOutput = run.stdout + '\n' + run.stderr;
  const stages = {
    daytona: /2\/3\s+Neo4j|3\/3\s+Nosana|=== PR MERGE RISK REPORT ===/.test(allOutput),
    neo4j: /3\/3\s+Nosana|=== PR MERGE RISK REPORT ===/.test(allOutput),
    nosana: /=== PR MERGE RISK REPORT ===/.test(allOutput)
  };

  if (run.code === 0 || run.code === 2) {
    const match = allOutput.match(/Blast radius: src\/permissions\.js\s*→\s*(.*)/);
    const blastRadius = match && match[1].trim() !== 'none'
      ? match[1].split(',').map(path => path.trim()).filter(Boolean)
      : [];
    const reportMarker = '=== PR MERGE RISK REPORT ===';
    const markerIndex = allOutput.indexOf(reportMarker);
    const report = markerIndex >= 0
      ? allOutput.slice(markerIndex + reportMarker.length).trim()
      : '';
    const testPassed = !/Sandbox test result: FAIL/.test(allOutput);
    return {
      state: 'complete',
      stages,
      testPassed,
      testLabel: testPassed ? 'Tests passed' : 'Tests caught PR',
      blastRadius,
      graphState: blastRadius.length ? 'found' : 'no_dependents',
      report,
      reportMode: 'nosana'
    };
  }

  let failureStage = 'daytona';
  if (stages.daytona || /NEO4J/i.test(allOutput)) failureStage = 'neo4j';
  if (stages.neo4j || /NOSANA/i.test(allOutput)) failureStage = 'nosana';
  const message = (run.stderr || run.stdout).replace(/\s+/g, ' ').trim().slice(-900);
  return {
    state: failureStage === 'nosana' ? 'inference_fallback' : 'blocked',
    stages,
    failureStage,
    failure: message || 'The demo process exited before completing this stage.',
    reportMode: failureStage === 'nosana' ? 'local-fallback' : null,
    report: failureStage === 'nosana'
      ? 'LOCAL FALLBACK — Nosana did not return a report. No model verdict is shown. Retry inference or continue with a manual review.'
      : null
  };
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    respond(res, 200, page, 'text/html; charset=utf-8');
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    respond(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/run') {
    if (isRunning) {
      respond(res, 409, { error: 'A review is already running.' });
      return;
    }
    isRunning = true;
    try {
      const result = summarizeRun(await runConsoleDemo());
      respond(res, result.state === 'blocked' ? 503 : 200, result);
    } catch (error) {
      respond(res, 500, { error: error.message });
    } finally {
      isRunning = false;
    }
    return;
  }
  respond(res, 404, { error: 'Not found.' });
});

server.listen(port, host, () => {
  console.log('PR safety demo UI: http://' + host + ':' + port);
});
