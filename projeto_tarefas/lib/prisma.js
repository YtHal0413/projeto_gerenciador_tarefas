require('dotenv').config();

// lib/prisma.js
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./dev.db'
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;