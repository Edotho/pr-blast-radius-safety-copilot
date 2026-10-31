import test from 'node:test';
import assert from 'node:assert/strict';
import { canApprove } from '../src/permissions.js';
import { approvePullRequest } from '../src/approval.js';
import { releasePullRequest } from '../src/release.js';

test('owners and admins may approve', () => {
  assert.equal(canApprove('owner'), true);
  assert.equal(canApprove('admin'), true);
});

test('contributors cannot approve or release a pull request', () => {
  assert.equal(canApprove('contributor'), false);
  assert.equal(approvePullRequest('contributor'), 'blocked');
  assert.equal(releasePullRequest('contributor'), 'held');
});
