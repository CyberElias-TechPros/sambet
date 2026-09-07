export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US');
}

/** +2348039189574 → +234 803 918 9574 */
export function displayPhone(value: string | null | undefined): string {
  if (!value) return '—';
  const m = value.replace(/\D/g, '');
  if (m.length === 13 && m.startsWith('234')) return `+234 ${m.slice(3, 6)} ${m.slice(6, 9)} ${m.slice(9)}`;
  return value;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function downloadUrl(url: string) {
  window.location.href = url;
}

export const STATUS_LABELS: Record<string, string> = {
  registered: 'Registered',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  inactive: 'Inactive',
};

export const STATUS_STYLES: Record<string, string> = {
  registered: 'bg-stone-100 text-stone-700 ring-stone-200',
  in_review: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-leaf-50 text-leaf-700 ring-leaf-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  inactive: 'bg-stone-50 text-stone-500 ring-stone-200',
};

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'account.setup': 'Account created',
    'auth.login': 'Signed in',
    'password.change': 'Password changed',
    'password.reset': 'Password reset',
    'org.create': 'Organization added',
    'org.update': 'Organization updated',
    'org.delete': 'Organization deleted',
    'org.bulk_delete': 'Bulk deletion',
    'import.completed': 'Import completed',
    'import.submitted': 'Import submitted for approval',
    'import.approved': 'Import approved',
    'import.rejected': 'Import rejected',
    'user.created': 'Team member added',
    'user.updated': 'Team member updated',
    'submission.public': 'Public submission received',
    'submission.verified': 'Submission verified',
    'submission.rejected': 'Submission rejected',
  };
  return labels[action] ?? action;
}

/** Naira amount with separators: 1500 → "₦1,500". */
export function formatNaira(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '₦0';
  return `₦${n.toLocaleString('en-NG')}`;
}

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const MATCH_LABELS: Record<string, string> = {
  phone: 'Same phone',
  account: 'Same account',
  'name+state': 'Same name + state',
};
