import { getInvitationByToken } from '@/server/collaboration/invitationService';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AcceptInviteButton from './AcceptInviteButton';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  const invitation = await getInvitationByToken(token);
  const session = await auth();

  if (!invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">&#x26A0;</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation Not Found</h1>
          <p className="text-slate-500 text-sm mb-6">
            This invitation link is invalid, has expired, or has already been used.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // If not signed in, redirect to login with returnUrl
  if (!session?.user?.id) {
    redirect(`/login?returnUrl=/invite/${token}`);
  }

  const roleLabels: Record<string, string> = {
    COLLABORATOR: 'Collaborator',
    ADVISOR: 'Financial Advisor',
    VIEWER: 'Viewer',
    OWNER: 'Owner',
  };

  const permLabels: Record<string, string> = {
    VIEW: 'View only',
    EDIT: 'View and edit',
    MANAGE: 'Full management',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-slate-900 mb-1">You have been invited</h1>
        <p className="text-sm text-slate-500 mb-6">
          Review the invitation details below and accept to gain access.
        </p>

        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Household</span>
            <span className="text-slate-900 font-semibold">{invitation.householdName ?? 'Household'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Invited by</span>
            <span className="text-slate-900">{invitation.invitedByEmail ?? 'Household owner'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Your role</span>
            <span className="text-slate-900">{roleLabels[invitation.role] ?? invitation.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Access level</span>
            <span className="text-slate-900">{permLabels[invitation.permissionLevel] ?? invitation.permissionLevel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Sent to</span>
            <span className="text-slate-900">{invitation.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Expires</span>
            <span className="text-slate-900">
              {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {session.user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            <p className="font-medium mb-1">Email mismatch</p>
            <p>
              This invitation was sent to <strong>{invitation.email}</strong>, but you are signed in as{' '}
              <strong>{session.user.email}</strong>. Please sign in with the invited email address to accept.
            </p>
            <Link
              href="/login"
              className="inline-block mt-3 text-red-800 underline text-xs"
            >
              Sign in with a different account
            </Link>
          </div>
        ) : (
          <AcceptInviteButton token={token} />
        )}
      </div>
    </div>
  );
}
