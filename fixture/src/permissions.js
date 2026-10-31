export function canApprove(role) {
  return role === 'owner' || role === 'admin';
}
