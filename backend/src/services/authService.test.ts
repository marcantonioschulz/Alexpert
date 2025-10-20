import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@prisma/client';

vi.hoisted(() => {
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.JWT_SECRET = 'unit-secret';
});

const { findUniqueMock } = vi.hoisted(() => {
  return { findUniqueMock: vi.fn() };
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    adminUser: {
      findUnique: findUniqueMock
    }
  }
}));

import {
  authenticateAdmin,
  generateAdminToken,
  hashPassword,
  verifyAdminToken,
  verifyPassword
} from './authService.js';

describe('authService', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it('hashes and verifies passwords using bcrypt', async () => {
    const password = 'StrongPass!123';
    const hash = await hashPassword(password);

    expect(hash).not.toEqual(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('authenticates admin users with valid credentials', async () => {
    const password = 'AnotherPass!456';
    const passwordHash = await hashPassword(password);

    const adminRecord: AdminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    findUniqueMock.mockResolvedValue(adminRecord);

    await expect(authenticateAdmin(adminRecord.email, password)).resolves.toEqual(adminRecord);
    await expect(authenticateAdmin(adminRecord.email, 'bad-pass')).resolves.toBeNull();

    findUniqueMock.mockResolvedValue(null);
    await expect(authenticateAdmin('missing@example.com', password)).resolves.toBeNull();
  });

  it('generates JWTs with an admin role claim', () => {
    const admin: AdminUser = {
      id: 'admin-2',
      email: 'admin2@example.com',
      passwordHash: 'hash',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    } as const;

    const token = generateAdminToken(admin);
    const payload = verifyAdminToken(token);

    expect(payload.sub).toBe(admin.id);
    expect(payload.email).toBe(admin.email);
    expect(payload.role).toBe('admin');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});
