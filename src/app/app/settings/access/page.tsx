'use client';

import { useEffect, useState, useCallback } from 'react';

type HouseholdRole = 'OWNER' | 'COLLABORATOR' | 'ADVISOR' | 'VIEWER';
type PermissionLevel = 'VIEW' | 'EDIT' | 'MANAGE';

interface Member {
  id: string;
  userId: string;
  role: HouseholdRole;
  permissionLevel: PermissionLevel;
  status: string;
  userEmail?: string;
  userName?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: HouseholdRole;
  permissionLevel: PermissionLevel;
  token: string;
  expiresAt: string;
  invitedByEmail?: string;
}

interface ActivityEntry {
  id: string;
  actorEmail?: string;
  action: string;
  targetEmail?: string;
  details?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<HouseholdRole, string> = {
  OWNER: 'bg-blue-100 text-blue-800',
  COLLABORATOR: 'bg-green-100 text-green-800',
  ADVISOR: 'bg-purple-100 text-purple-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const DEFAULT_PERMISSIONS: Record<string, PermissionLevel> = {
  COLLABORATOR: 'EDIT',
  ADVISOR: 'VIEW',
  VIEWER: 'VIEW',
};

export default function AccessManagementPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('COLLABORATOR');
  const [invitePermission, setInvitePermission] = useState<PermissionLevel>('EDIT');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; link: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async (hid: string) => {
    try {
      const [membersRes, invitationsRes, activityRes] = await Promise.all([
        fetch(`/api/collaboration/members?householdId=${hid}`),
        fetch(`/api/collaboration/invitations?householdId=${hid}`),
        fetch(`/api/collaboration/activity?householdId=${hid}`),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
      }
      if (invitationsRes.ok) {
        const data = await invitationsRes.json();
        setInvitations(data.invitations ?? []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities((data.activities ?? []).slice(0, 20));
      }
    } catch {
      setError('Failed to load access data');
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await fetch('/api/collaboration/households');
        if (!res.ok) { setError('Failed to load household'); setLoading(false); return; }
        const data = await res.json();
        const owned = (data.households ?? []).find((h: { isOwner: boolean; householdId: string }) => h.isOwner);
        const hid = owned?.householdId ?? data.households?.[0]?.householdId;
        if (!hid) { setError('No household found'); setLoading(false); return; }
        setHouseholdId(hid);
        await loadData(hid);
      } catch {
        setError('Failed to initialize');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadData]);

  // Auto-set permission level when role changes
  function handleRoleChange(role: string) {
    setInviteRole(role);
    setInvitePermission(DEFAULT_PERMISSIONS[role] ?? 'VIEW');
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId) return;
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);

    try {
      const res = await fetch('/api/collaboration/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId,
          email: inviteEmail,
          role: inviteRole,
          permissionLevel: invitePermission,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to create invitation');
      } else {
        const token = data.invitation.token;
        const link = `${window.location.origin}/invite/${token}`;
        setInviteResult({ token, link });
        setInviteEmail('');
        await loadData(householdId);
      }
    } catch {
      setInviteError('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!householdId || !confirm('Revoke this invitation?')) return;
    const res = await fetch('/api/collaboration/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, householdId }),
    });
    if (res.ok) await loadData(householdId);
  }

  async function handleRemoveMember(targetUserId: string, email?: string) {
    if (!householdId || !confirm(`Remove ${email ?? targetUserId} from household?`)) return;
    const res = await fetch('/api/collaboration/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, targetUserId }),
    });
    if (res.ok) await loadData(householdId);
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatAction(action: string) {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const isOwner = members.some((m) => m.role === 'OWNER' && m.id.startsWith('owner-'));

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Household Access Management</h1>
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Household Access Management</h1>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Household Access Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Invite collaborators, advisors, or viewers to access this household&apos;s retirement plan.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        Access control is enforced server-side. Users cannot access household data without explicit invitation and acceptance.
      </div>

      {/* Current Members */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Current Members</h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name / Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Permission</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.userName ?? m.userEmail ?? m.userId}</div>
                    {m.userName && <div className="text-slate-500 text-xs">{m.userEmail}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.permissionLevel}</td>
                  <td className="px-4 py-3 text-slate-600">{m.status}</td>
                  <td className="px-4 py-3">
                    {m.role !== 'OWNER' && isOwner ? (
                      <button
                        onClick={() => handleRemoveMember(m.userId, m.userEmail)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Invitations */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Pending Invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invitations.</p>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-slate-900">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[inv.role]}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.expiresAt)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invite New Member */}
      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Invite New Member</h2>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="colleague@example.com"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="COLLABORATOR">Collaborator</option>
                    <option value="ADVISOR">Advisor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Permission Level</label>
                  <select
                    value={invitePermission}
                    onChange={(e) => setInvitePermission(e.target.value as PermissionLevel)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VIEW">View</option>
                    <option value="EDIT">Edit</option>
                  </select>
                </div>
              </div>

              {inviteError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {inviteError}
                </div>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>

            {/* Invite Link Modal */}
            {inviteResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800 mb-2">Invitation created. Share this link:</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteResult.link}
                    className="flex-1 text-xs border border-green-300 rounded px-2 py-1 bg-white font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(inviteResult.link)}
                    className="text-xs bg-green-700 text-white px-3 py-1 rounded font-medium hover:bg-green-800"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-green-700 mt-1">Link expires in 7 days.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Activity Log */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Recent Activity</h2>
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {activities.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{a.actorEmail ?? 'System'}</span>
                    {' '}
                    {formatAction(a.action)}
                    {a.targetEmail && (
                      <span className="text-slate-600"> &rarr; {a.targetEmail}</span>
                    )}
                  </p>
                  {a.details && <p className="text-xs text-slate-500 mt-0.5">{a.details}</p>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
