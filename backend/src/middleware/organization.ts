import type { FastifyRequest, FastifyReply } from 'fastify';
import { getOrganizationByClerkId, syncOrganization, addOrganizationMember } from '../services/clerkSync.js';
import { checkQuota } from '../services/quota.js';
import { clerk } from './clerk-auth.js';

/**
 * Resolve and attach organization to request context
 * Must be used after verifyClerkAuth
 * This middleware:
 * 1. Resolves organization from Clerk org ID
 * 2. Syncs organization data to database if needed
 * 3. Verifies user membership in organization
 * 4. Attaches organization to request context
 */
export async function resolveOrganization(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Ensure user is authenticated
    if (!request.user || !request.clerkUserId) {
      reply.status(401).send({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    // Get organization ID from request context or header
    const orgId = request.clerkOrgId || request.headers['x-organization-id'] as string;

    if (!orgId) {
      reply.status(400).send({
        code: 'ORG_ID_REQUIRED',
        message: 'Organization ID required'
      });
      return;
    }

    // Try to get organization from database
    let organization = await getOrganizationByClerkId(orgId);

    // If organization doesn't exist, sync it from Clerk
    if (!organization) {
      try {
        const clerkOrg = await clerk.organizations.getOrganization({
          organizationId: orgId
        });

        // Sync organization to database
        organization = await syncOrganization(
          {
            id: clerkOrg.id,
            name: clerkOrg.name,
            slug: clerkOrg.slug || clerkOrg.id,
            imageUrl: clerkOrg.imageUrl || undefined,
            createdBy: clerkOrg.createdBy
          },
          request.user.id
        );

        // Add user as member (if not owner)
        if (clerkOrg.createdBy !== request.clerkUserId) {
          await addOrganizationMember(
            request.user.id,
            organization.id,
            request.clerkOrgRole === 'admin' ? 'ADMIN' : 'MEMBER'
          );
        }
      } catch (error) {
        request.log.error(
          {
            err: error,
            orgId,
            userId: request.user.id
          },
          'Failed to sync organization from Clerk'
        );

        reply.status(500).send({
          code: 'ORG_SYNC_FAILED',
          message: 'Failed to sync organization'
        });
        return;
      }
    }

    // Verify user is a member of the organization
    const membership = await request.server.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user.id,
          organizationId: organization.id
        }
      }
    });

    if (!membership && organization.ownerId !== request.user.id) {
      reply.status(403).send({
        code: 'ORG_ACCESS_DENIED',
        message: 'Access denied to this organization'
      });
      return;
    }

    // Attach organization to request
    request.organization = organization;
    request.organizationRole = membership?.role || 'OWNER';

    request.log.debug(
      {
        organizationId: organization.id,
        organizationName: organization.name,
        userId: request.user.id,
        role: request.organizationRole
      },
      'Organization resolved'
    );
  } catch (error) {
    request.log.error(
      {
        err: error,
        route: request.url
      },
      'Organization resolution failed'
    );

    reply.status(500).send({
      code: 'ORG_RESOLUTION_FAILED',
      message: 'Failed to resolve organization'
    });
  }
}

/**
 * Check organization quota before proceeding
 * Must be used after resolveOrganization
 */
export async function checkOrganizationQuota(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.organization) {
    reply.status(400).send({
      code: 'ORG_CONTEXT_MISSING',
      message: 'Organization context required'
    });
    return;
  }

  try {
    const quotaStatus = await checkQuota(request.organization.id);

    // Attach quota status to request for reference
    request.quotaStatus = quotaStatus;

    if (!quotaStatus.canProceed) {
      reply.status(429).send({
        code: 'QUOTA_EXCEEDED',
        message: `Monthly quota exceeded. Limit: ${quotaStatus.limit}, Current: ${quotaStatus.current}`,
        context: {
          current: quotaStatus.current,
          limit: quotaStatus.limit,
          resetDate: quotaStatus.resetDate.toISOString()
        }
      });
      return;
    }

    request.log.debug(
      {
        organizationId: request.organization.id,
        quota: quotaStatus
      },
      'Quota check passed'
    );
  } catch (error) {
    request.log.error(
      {
        err: error,
        organizationId: request.organization.id
      },
      'Quota check failed'
    );

    reply.status(500).send({
      code: 'QUOTA_CHECK_FAILED',
      message: 'Failed to check quota'
    });
  }
}

/**
 * Require specific organization plan
 * Must be used after resolveOrganization
 */
export function requirePlan(...allowedPlans: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.organization) {
      reply.status(400).send({
        code: 'ORG_CONTEXT_MISSING',
        message: 'Organization context required'
      });
      return;
    }

    if (!allowedPlans.includes(request.organization.plan)) {
      reply.status(403).send({
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `This feature requires one of: ${allowedPlans.join(', ')}`,
        context: {
          currentPlan: request.organization.plan,
          requiredPlans: allowedPlans
        }
      });
      return;
    }
  };
}

/**
 * Require specific organization permission
 * Must be used after resolveOrganization
 */
export function requireOrgRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.organizationRole) {
      reply.status(403).send({
        code: 'ORG_ROLE_REQUIRED',
        message: 'Organization role required'
      });
      return;
    }

    if (!allowedRoles.includes(request.organizationRole)) {
      reply.status(403).send({
        code: 'INSUFFICIENT_ORG_PERMISSIONS',
        message: `Requires one of: ${allowedRoles.join(', ')}`
      });
      return;
    }
  };
}
