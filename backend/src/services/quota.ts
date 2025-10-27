import { prisma } from '../lib/prisma.js';

export interface QuotaStatus {
  current: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  isUnlimited: boolean;
  canProceed: boolean;
}

/**
 * Check if organization has quota available
 * @param organizationId - Organization ID to check
 * @returns Quota status with current usage and limits
 */
export async function checkQuota(organizationId: string): Promise<QuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      currentUsage: true,
      monthlyQuota: true,
      resetDate: true,
      plan: true
    }
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Check if quota needs to be reset
  const now = new Date();
  if (now >= org.resetDate) {
    await resetQuota(organizationId);
    return {
      current: 0,
      limit: org.monthlyQuota,
      remaining: org.monthlyQuota,
      resetDate: org.resetDate,
      isUnlimited: org.plan === 'ENTERPRISE',
      canProceed: true
    };
  }

  const isUnlimited = org.plan === 'ENTERPRISE';
  const canProceed = isUnlimited || org.currentUsage < org.monthlyQuota;
  const remaining = isUnlimited ? Infinity : Math.max(0, org.monthlyQuota - org.currentUsage);

  return {
    current: org.currentUsage,
    limit: org.monthlyQuota,
    remaining,
    resetDate: org.resetDate,
    isUnlimited,
    canProceed
  };
}

/**
 * Increment organization's quota usage
 * @param organizationId - Organization ID
 * @param amount - Amount to increment (default: 1)
 * @throws Error if quota is exceeded
 */
export async function incrementQuota(
  organizationId: string,
  amount: number = 1
): Promise<QuotaStatus> {
  // Check current quota status
  const status = await checkQuota(organizationId);

  // ENTERPRISE plan has unlimited quota
  if (status.isUnlimited) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        currentUsage: {
          increment: amount
        }
      }
    });

    return {
      ...status,
      current: status.current + amount
    };
  }

  // Check if quota would be exceeded
  if (!status.canProceed || status.current + amount > status.limit) {
    throw new Error(
      `Quota exceeded. Current: ${status.current}, Limit: ${status.limit}, Resets: ${status.resetDate.toISOString()}`
    );
  }

  // Increment usage
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      currentUsage: {
        increment: amount
      }
    },
    select: {
      currentUsage: true,
      monthlyQuota: true,
      resetDate: true,
      plan: true
    }
  });

  return {
    current: updated.currentUsage,
    limit: updated.monthlyQuota,
    remaining: Math.max(0, updated.monthlyQuota - updated.currentUsage),
    resetDate: updated.resetDate,
    isUnlimited: false,
    canProceed: updated.currentUsage < updated.monthlyQuota
  };
}

/**
 * Reset organization's quota usage
 * Sets currentUsage to 0 and updates resetDate to next month
 * @param organizationId - Organization ID
 */
export async function resetQuota(organizationId: string): Promise<void> {
  const nextResetDate = new Date();
  nextResetDate.setDate(nextResetDate.getDate() + 30);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      currentUsage: 0,
      resetDate: nextResetDate
    }
  });
}

/**
 * Get quota status for multiple organizations
 * Useful for dashboard/admin views
 */
export async function getOrganizationsQuotaStatus(
  organizationIds: string[]
): Promise<Map<string, QuotaStatus>> {
  const orgs = await prisma.organization.findMany({
    where: {
      id: {
        in: organizationIds
      }
    },
    select: {
      id: true,
      currentUsage: true,
      monthlyQuota: true,
      resetDate: true,
      plan: true
    }
  });

  const statusMap = new Map<string, QuotaStatus>();

  for (const org of orgs) {
    const now = new Date();
    const needsReset = now >= org.resetDate;
    const isUnlimited = org.plan === 'ENTERPRISE';
    const currentUsage = needsReset ? 0 : org.currentUsage;
    const canProceed = isUnlimited || currentUsage < org.monthlyQuota;
    const remaining = isUnlimited ? Infinity : Math.max(0, org.monthlyQuota - currentUsage);

    statusMap.set(org.id, {
      current: currentUsage,
      limit: org.monthlyQuota,
      remaining,
      resetDate: org.resetDate,
      isUnlimited,
      canProceed
    });
  }

  return statusMap;
}

/**
 * Track token usage for a conversation
 * Updates both conversation and organization quota
 */
export async function trackTokenUsage(
  conversationId: string,
  organizationId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  // Update conversation token tracking
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      inputTokens,
      outputTokens
    }
  });

  // Increment organization usage (1 conversation)
  await incrementQuota(organizationId, 1);
}
