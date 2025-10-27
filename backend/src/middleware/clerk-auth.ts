import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { env } from '../lib/env.js';
import { syncUser, getUserByClerkId, type ClerkUserData } from '../services/clerkSync.js';

// Initialize Clerk client
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

export interface ClerkJWTPayload {
  sub: string; // Clerk user ID
  email: string;
  org_id?: string; // Current organization ID
  org_role?: string; // Role in current organization
  [key: string]: unknown;
}

/**
 * Verify Clerk session token and attach user to request
 * This middleware:
 * 1. Extracts and verifies Clerk JWT token
 * 2. Syncs user data to database
 * 3. Attaches user object to request context
 */
export async function verifyClerkAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      reply.status(401).send({
        code: 'AUTH_MISSING_TOKEN',
        message: 'Missing or invalid authorization header'
      });
      return;
    }

    const token = authorization.slice('Bearer '.length).trim();

    // Verify token with Clerk
    const verifiedToken = await clerk.verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    });

    if (!verifiedToken || !verifiedToken.sub) {
      reply.status(401).send({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid session token'
      });
      return;
    }

    // Get full user data from Clerk
    const clerkUser = await clerk.users.getUser(verifiedToken.sub);

    // Sync user to database
    const userData: ClerkUserData = {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || undefined,
      lastName: clerkUser.lastName || undefined,
      imageUrl: clerkUser.imageUrl || undefined,
      emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified'
    };

    const user = await syncUser(userData);

    // Extract custom claims from verified token
    const payload = verifiedToken as unknown as ClerkJWTPayload;

    // Attach user and Clerk data to request
    request.user = user;
    request.clerkUserId = verifiedToken.sub;
    request.clerkOrgId = payload.org_id;
    request.clerkOrgRole = payload.org_role;

    // Log successful authentication
    request.log.debug(
      {
        userId: user.id,
        clerkUserId: payload.sub,
        email: user.email
      },
      'User authenticated via Clerk'
    );
  } catch (error) {
    request.log.warn(
      {
        err: error,
        route: request.url
      },
      'Clerk authentication failed'
    );

    reply.status(401).send({
      code: 'AUTH_FAILED',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional Clerk auth middleware
 * Attempts to verify token but doesn't fail if token is missing
 * Useful for endpoints that have optional authentication
 */
export async function optionalClerkAuth(
  request: FastifyRequest
): Promise<void> {
  const authorization = request.headers.authorization;

  // If no token provided, continue without authentication
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return;
  }

  try {
    const token = authorization.slice('Bearer '.length).trim();
    const verifiedToken = await clerk.verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    });

    if (verifiedToken && verifiedToken.sub) {
      // Get user from database
      const user = await getUserByClerkId(verifiedToken.sub);

      if (user) {
        const payload = verifiedToken as unknown as ClerkJWTPayload;
        request.user = user;
        request.clerkUserId = verifiedToken.sub;
        request.clerkOrgId = payload.org_id;
        request.clerkOrgRole = payload.org_role;
      }
    }
  } catch (error) {
    // Silent failure for optional auth
    request.log.debug(
      {
        err: error,
        route: request.url
      },
      'Optional Clerk authentication skipped'
    );
  }
}

/**
 * Require specific Clerk organization membership
 * Must be used after verifyClerkAuth
 */
export async function requireOrganization(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.clerkOrgId) {
    reply.status(403).send({
      code: 'ORG_REQUIRED',
      message: 'Organization context required for this operation'
    });
    return;
  }
}

/**
 * Require specific role in organization
 * Must be used after verifyClerkAuth and requireOrganization
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.clerkOrgRole) {
      reply.status(403).send({
        code: 'ORG_ROLE_REQUIRED',
        message: 'Organization role required for this operation'
      });
      return;
    }

    if (!allowedRoles.includes(request.clerkOrgRole)) {
      reply.status(403).send({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Requires one of: ${allowedRoles.join(', ')}`
      });
      return;
    }
  };
}

// Export Clerk client for use in other services
export { clerk };
