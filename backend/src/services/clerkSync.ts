import { prisma } from '../lib/prisma.js';
import type { User, Organization, PlanType, OrgRole } from '@prisma/client';

export interface ClerkUserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  emailVerified: boolean;
}

export interface ClerkOrgData {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  createdBy: string;
}

/**
 * Sync a Clerk user to the database
 * Creates or updates user record based on Clerk data
 */
export async function syncUser(clerkData: ClerkUserData): Promise<User> {
  const name = [clerkData.firstName, clerkData.lastName]
    .filter(Boolean)
    .join(' ') || null;

  const user = await prisma.user.upsert({
    where: { clerkUserId: clerkData.id },
    update: {
      email: clerkData.email,
      name,
      avatar: clerkData.imageUrl,
      emailVerified: clerkData.emailVerified,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    },
    create: {
      clerkUserId: clerkData.id,
      email: clerkData.email,
      name,
      avatar: clerkData.imageUrl,
      emailVerified: clerkData.emailVerified,
      lastLoginAt: new Date()
    }
  });

  return user;
}

/**
 * Sync a Clerk organization to the database
 * Creates or updates organization record based on Clerk data
 */
export async function syncOrganization(
  clerkData: ClerkOrgData,
  ownerId: string
): Promise<Organization> {
  // Set initial reset date to 30 days from now
  const resetDate = new Date();
  resetDate.setDate(resetDate.getDate() + 30);

  const org = await prisma.organization.upsert({
    where: { clerkOrgId: clerkData.id },
    update: {
      name: clerkData.name,
      slug: clerkData.slug,
      logo: clerkData.imageUrl,
      updatedAt: new Date()
    },
    create: {
      clerkOrgId: clerkData.id,
      name: clerkData.name,
      slug: clerkData.slug,
      logo: clerkData.imageUrl,
      plan: 'FREE',
      monthlyQuota: 50,
      currentUsage: 0,
      resetDate,
      ownerId
    }
  });

  return org;
}

/**
 * Add a user to an organization as a member
 * Creates the membership record if it doesn't exist
 */
export async function addOrganizationMember(
  userId: string,
  organizationId: string,
  role: OrgRole = 'MEMBER'
): Promise<void> {
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    },
    update: {
      role
    },
    create: {
      userId,
      organizationId,
      role
    }
  });
}

/**
 * Remove a user from an organization
 */
export async function removeOrganizationMember(
  userId: string,
  organizationId: string
): Promise<void> {
  await prisma.organizationMember.deleteMany({
    where: {
      userId,
      organizationId
    }
  });
}

/**
 * Get user by Clerk user ID
 */
export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { clerkUserId }
  });
}

/**
 * Get organization by Clerk org ID
 */
export async function getOrganizationByClerkId(clerkOrgId: string): Promise<Organization | null> {
  return prisma.organization.findUnique({
    where: { clerkOrgId }
  });
}

/**
 * Update organization plan and quota limits
 */
export async function updateOrganizationPlan(
  organizationId: string,
  plan: PlanType,
  monthlyQuota: number,
  featureFlags?: {
    canUseSharedKeys?: boolean;
    canUseSSO?: boolean;
    canCustomizePrompts?: boolean;
    maxMembers?: number;
  }
): Promise<Organization> {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan,
      monthlyQuota,
      ...featureFlags
    }
  });
}

/**
 * Get all organizations a user is a member of
 */
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: true
    }
  });

  return memberships.map(m => m.organization);
}
