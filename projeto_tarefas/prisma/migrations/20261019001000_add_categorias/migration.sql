-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Tarefa" ADD COLUMN "categoriaId" INTEGER REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_usuarioId_nome_key" ON "Categoria"("usuarioId", "nome");

-- CreateIndex
CREATE INDEX "Tarefa_categoriaId_idx" ON "Tarefa"("categoriaId");
