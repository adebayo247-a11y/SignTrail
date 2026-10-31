const { PrismaClient } = require('@prisma/client');

// Initialize Prisma and extend it to strictly enforce the append-only rule for AuditEntry
const prisma = new PrismaClient().$extends({
  query: {
    auditEntry: {
      async update() {
        throw new Error('Audit trail is append-only. Updates are strictly forbidden.');
      },
      async updateMany() {
        throw new Error('Audit trail is append-only. Updates are strictly forbidden.');
      },
      async delete() {
        throw new Error('Audit trail is append-only. Deletes are strictly forbidden.');
      },
      async deleteMany() {
        throw new Error('Audit trail is append-only. Deletes are strictly forbidden.');
      }
    }
  }
});

module.exports = prisma;