# Gerenciador de Tarefas

Aplicação web para organizar tarefas. 

Cada usuário tem sua própria lista e pode criar, editar, excluir e concluir tarefas. 
Possui método de autenticação com JWT em cookie HTTP-only com criptografia de senhas feita com bcrypt.

## Funcionalidades

- Cadastro de conta, login e logout.
- Edição de nome, e-mail e senha do perfil.
- Criação de tarefas: título, descrição e marcador de nível de prioridade (alta, média ou baixa.)
- Edição, exclusão e marcação de conclusão das mesmas.
- Criação de categorias para agrupamento de tarefas.
- Opção de organização por categoria e seus respectivos filtros.
- Formas de ordenação por prioridade, título (A–Z) e data de criação (crescentes ou decrescentes).
- Pesquisa de tarefas.

## Execução

1. Entre na pasta `projeto_tarefas`.
2. Instale as dependências do projeto
   
   ```
   npm install
   ```
   
3. Crie um arquivo .env com este conteúdo (altere manualmente onde indicado)

   ```
   DATABASE_URL = 'file:./banco.db'

   JWT_SECRET = coloque_seu_segredo
   JWT_EXPIRATION = 1h
   ```

4. Inicialize o prisma:

   ```
   npx prisma generate
   ```
   ```
   npx prisma migrate deploy
   ```

5. Inicie o servidor:

   ```
   node app.js
   ```

5. Acesse `http://localhost:5000`.
