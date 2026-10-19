require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const usuarios = await prisma.usuario.findMany();
  const tarefas = await prisma.tarefa.count();

  console.log('Quantidade de usuários:', usuarios.length);
  console.log('Quantidade de tarefas:', tarefas);
}

main()
  .catch((erro) => {
    console.error('Erro ao consultar o banco de dados:', erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });