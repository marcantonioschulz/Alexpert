import type { AdminJwtPayload } from '../services/authService.js';
import type { User, Organization, OrgRole } from '@prisma/client';
import type { QuotaStatus } from '../services/quota.js';
import type { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    // Legacy admin auth (keep for backward compatibility)
    admin?: AdminJwtPayload;

    // Clerk authentication
    user?: User;
    clerkUserId?: string;
    clerkOrgId?: string;
    clerkOrgRole?: string;

    // Organization context
    organization?: Organization;
    organizationRole?: OrgRole;

    // Quota status
    quotaStatus?: QuotaStatus;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
