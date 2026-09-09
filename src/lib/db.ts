import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let url = (process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL)?.replace(/^["']|["']$/g, '').trim();
if (url && !url.includes('connect_timeout')) {
  url += (url.includes('?') ? '&' : '?') + 'connect_timeout=15';
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    ...(url ? { datasources: { db: { url } } } : {})
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db