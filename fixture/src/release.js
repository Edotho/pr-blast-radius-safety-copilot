import { approvePullRequest } from './approval.js';

export function releasePullRequest(role) {
  return approvePullRequest(role) === 'approved' ? 'released' : 'held';
}
