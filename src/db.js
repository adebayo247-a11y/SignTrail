const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = prisma;