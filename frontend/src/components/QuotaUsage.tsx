import { useOrganizationContext } from '../hooks/useOrganization';

export function QuotaUsage() {
  const { quotaStatus, organization, loading } = useOrganizationContext();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!quotaStatus || !organization) {
    return null;
  }

  const percentageUsed = quotaStatus.isUnlimited
    ? 0
    : (quotaStatus.current / quotaStatus.limit) * 100;

  const getProgressColor = () => {
    if (quotaStatus.isUnlimited) return 'bg-green-500';
    if (percentageUsed >= 90) return 'bg-red-500';
    if (percentageUsed >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getPlanBadgeColor = () => {
    switch (organization.plan) {
      case 'FREE':
        return 'bg-gray-100 text-gray-800';
      case 'PROFESSIONAL':
        return 'bg-blue-100 text-blue-800';
      case 'BUSINESS':
        return 'bg-purple-100 text-purple-800';
      case 'ENTERPRISE':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quota Usage</h3>
          <p className="text-sm text-gray-500">{organization.name}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor()}`}
        >
          {organization.plan}
        </span>
      </div>

      {quotaStatus.isUnlimited ? (
        <div className="text-center py-4">
          <div className="text-3xl font-bold text-green-600 mb-2">Unlimited</div>
          <p className="text-sm text-gray-600">
            Your plan includes unlimited conversations
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">
                {quotaStatus.current} / {quotaStatus.limit} conversations
              </span>
              <span className="text-gray-600">{Math.round(percentageUsed)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className="font-medium">{quotaStatus.remaining} conversations</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Resets on:</span>
              <span className="font-medium">
                {new Date(quotaStatus.resetDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          {!quotaStatus.canProceed && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Quota exceeded!</strong> Upgrade your plan to continue using the
                service.
              </p>
            </div>
          )}

          {quotaStatus.remaining <= quotaStatus.limit * 0.1 &&
            quotaStatus.canProceed && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Low quota:</strong> You&apos;re running low on conversations.
                  Consider upgrading your plan.
                </p>
              </div>
            )}
        </>
      )}
    </div>
  );
}
