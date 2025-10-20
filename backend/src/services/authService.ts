import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AdminUser } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';

const SALT_ROUNDS = 12;

export type AdminJwtPayload = {
  sub: string;
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function authenticateAdmin(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  if (!admin) {
    return null;
  }

  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid || admin.role !== 'admin') {
    return null;
  }

  return admin;
}

export function generateAdminToken(admin: AdminUser): string {
  return jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      role: admin.role
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;

  if (payload.role !== 'admin') {
    throw new Error('Invalid role');
  }

  return payload;
}
