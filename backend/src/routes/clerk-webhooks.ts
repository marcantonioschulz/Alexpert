import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Webhook } from 'svix';
import { env } from '../lib/env.js';
import {
  syncUser,
  syncOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  getUserByClerkId,
  getOrganizationByClerkId,
  type ClerkUserData,
  type ClerkOrgData
} from '../services/clerkSync.js';

/**
 * Clerk Webhook Event Types
 */
type WebhookEvent =
  | { type: 'user.created'; data: ClerkWebhookUser }
  | { type: 'user.updated'; data: ClerkWebhookUser }
  | { type: 'user.deleted'; data: { id: string } }
  | { type: 'organization.created'; data: ClerkWebhookOrganization }
  | { type: 'organization.updated'; data: ClerkWebhookOrganization }
  | { type: 'organization.deleted'; data: { id: string } }
  | { type: 'organizationMembership.created'; data: ClerkWebhookMembership }
  | { type: 'organizationMembership.updated'; data: ClerkWebhookMembership }
  | { type: 'organizationMembership.deleted'; data: ClerkWebhookMembership };

interface ClerkWebhookUser {
  id: string;
  email_addresses: Array<{
    email_address: string;
    verification?: { status: string };
  }>;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

interface ClerkWebhookOrganization {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  created_by: string;
}

interface ClerkWebhookMembership {
  id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  public_user_data: {
    user_id: string;
  };
  role: string;
}

/**
 * Process Clerk webhook events
 */
export async function clerkWebhooksRoutes(app: FastifyInstance) {
  const wh = env.CLERK_WEBHOOK_SECRET
    ? new Webhook(env.CLERK_WEBHOOK_SECRET)
    : null;

  /**
   * Clerk Webhook Endpoint
   * Receives events from Clerk and syncs data to database
   */
  app.post(
    '/api/webhooks/clerk',
    {
      config: {
        // Skip rate limiting for webhooks
        rateLimit: false
      }
    },
    async (request, reply) => {
      // Verify webhook signature if secret is configured
      if (wh && env.CLERK_WEBHOOK_SECRET) {
        try {
          const payload = JSON.stringify(request.body);
          const headers = {
            'svix-id': request.headers['svix-id'] as string,
            'svix-timestamp': request.headers['svix-timestamp'] as string,
            'svix-signature': request.headers['svix-signature'] as string
          };

          // Verify the webhook
          wh.verify(payload, headers);
        } catch (error) {
          request.log.warn(
            {
              err: error,
              headers: request.headers
            },
            'Webhook signature verification failed'
          );

          return reply.status(401).send({
            code: 'WEBHOOK_VERIFICATION_FAILED',
            message: 'Invalid webhook signature'
          });
        }
      }

      const event = request.body as WebhookEvent;

      // Type guard to ensure event has correct structure
      if (!event || typeof event !== 'object' || !('type' in event)) {
        return reply.status(400).send({
          code: 'WEBHOOK_INVALID_PAYLOAD',
          message: 'Invalid webhook payload'
        });
      }

      request.log.info(
        {
          type: event.type,
          dataId: 'data' in event && event.data && 'id' in event.data ? event.data.id : undefined
        },
        'Processing Clerk webhook'
      );

      try {
        switch (event.type) {
          case 'user.created':
          case 'user.updated': {
            const userData: ClerkUserData = {
              id: event.data.id,
              email: event.data.email_addresses[0]?.email_address || '',
              firstName: event.data.first_name,
              lastName: event.data.last_name,
              imageUrl: event.data.image_url,
              emailVerified:
                event.data.email_addresses[0]?.verification?.status === 'verified'
            };

            await syncUser(userData);

            request.log.info(
              {
                userId: event.data.id,
                email: userData.email
              },
              `User ${event.type === 'user.created' ? 'created' : 'updated'}`
            );
            break;
          }

          case 'user.deleted': {
            // Soft delete or hard delete based on your requirements
            // For now, we'll keep the user data for referential integrity
            request.log.info(
              {
                userId: event.data.id
              },
              'User deleted (data retained for integrity)'
            );
            break;
          }

          case 'organization.created':
          case 'organization.updated': {
            // Get or create the owner user first
            const ownerUser = await getUserByClerkId(event.data.created_by);

            if (!ownerUser) {
              // If owner doesn't exist, we need to fetch from Clerk
              // This is a fallback case that shouldn't happen often
              request.log.warn(
                {
                  ownerId: event.data.created_by,
                  orgId: event.data.id
                },
                'Owner user not found, skipping org sync'
              );
              break;
            }

            const orgData: ClerkOrgData = {
              id: event.data.id,
              name: event.data.name,
              slug: event.data.slug,
              imageUrl: event.data.image_url,
              createdBy: event.data.created_by
            };

            await syncOrganization(orgData, ownerUser.id);

            request.log.info(
              {
                orgId: event.data.id,
                orgName: event.data.name
              },
              `Organization ${event.type === 'organization.created' ? 'created' : 'updated'}`
            );
            break;
          }

          case 'organization.deleted': {
            // Soft delete or hard delete based on your requirements
            // With CASCADE constraints, this will also delete memberships
            request.log.info(
              {
                orgId: event.data.id
              },
              'Organization deleted (data retained for integrity)'
            );
            break;
          }

          case 'organizationMembership.created':
          case 'organizationMembership.updated': {
            const user = await getUserByClerkId(event.data.public_user_data.user_id);
            const org = await getOrganizationByClerkId(event.data.organization.id);

            if (!user || !org) {
              request.log.warn(
                {
                  userId: event.data.public_user_data.user_id,
                  orgId: event.data.organization.id
                },
                'User or organization not found for membership sync'
              );
              break;
            }

            // Map Clerk roles to our OrgRole enum
            const role =
              event.data.role === 'admin'
                ? 'ADMIN'
                : event.data.role === 'org:admin'
                  ? 'OWNER'
                  : 'MEMBER';

            await addOrganizationMember(user.id, org.id, role as 'OWNER' | 'ADMIN' | 'MEMBER');

            request.log.info(
              {
                userId: user.id,
                orgId: org.id,
                role
              },
              `Organization membership ${event.type === 'organizationMembership.created' ? 'created' : 'updated'}`
            );
            break;
          }

          case 'organizationMembership.deleted': {
            const user = await getUserByClerkId(event.data.public_user_data.user_id);
            const org = await getOrganizationByClerkId(event.data.organization.id);

            if (!user || !org) {
              request.log.warn(
                {
                  userId: event.data.public_user_data.user_id,
                  orgId: event.data.organization.id
                },
                'User or organization not found for membership deletion'
              );
              break;
            }

            await removeOrganizationMember(user.id, org.id);

            request.log.info(
              {
                userId: user.id,
                orgId: org.id
              },
              'Organization membership deleted'
            );
            break;
          }

          default: {
            request.log.debug(
              {
                type: 'type' in event ? (event as { type: string }).type : 'unknown'
              },
              'Unhandled webhook event type'
            );
          }
        }

        return reply.send({ received: true });
      } catch (error) {
        request.log.error(
          {
            err: error,
            event: event.type
          },
          'Webhook processing failed'
        );

        return reply.status(400).send({
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: 'Failed to process webhook'
        });
      }
    }
  );
}
