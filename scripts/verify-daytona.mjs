import { runDaytona } from '../demo.mjs';

const result = await runDaytona();
if (result.passed) throw new Error('The crafted PR unexpectedly passed the sandbox test suite.');
if (!result.output.includes('true !== false')) {
  throw new Error('The expected contributor-permission test failure was not present in the sandbox output.');
}
console.log('Daytona verification passed: the isolated fixture ran and rejected the crafted PR.');
