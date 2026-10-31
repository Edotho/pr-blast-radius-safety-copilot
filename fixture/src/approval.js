import { canApprove } from './permissions.js';

export function approvePullRequest(role) {
  return canApprove(role) ? 'approved' : 'blocked';
}
