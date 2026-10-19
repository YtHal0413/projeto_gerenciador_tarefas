// Oi seu Daniel, não anote meu nome por favor

const express = require('express');
const methodOverride = require('method-override');
const path = require('path');

require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { autenticarJWT, usuarioOpcional } = require('./Middlewares/auth');
const logger = require('./Middlewares/logger');
const prisma = require('./lib/prisma');

const app = express();
const port = process.env.PORT || 5000;
const prioridades = new Set(['alta', 'media', 'baixa']);
const ordemPrioridade = { alta: 0, media: 1, baixa: 2 };
const mensagensSucesso = {
  criada: 'Tarefa criada com sucesso.',
  atualizada: 'Tarefa atualizada com sucesso.',
  concluida: 'Tarefa marcada como concluída.',
  reaberta: 'Tarefa reaberta.',
  excluida: 'Tarefa excluída.',
  perfil: 'Perfil atualizado com sucesso.',
  categoriaCriada: 'Categoria criada com sucesso.',
  categoriaAtualizada: 'Categoria atualizada com sucesso.',
  categoriaExcluida: 'Categoria excluída. As tarefas associadas foram mantidas sem categoria.'
};

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(logger);
app.use(usuarioOpcional);
app.use((req, res, next) => {
  res.locals.usuarioLogado = req.user || null;
  next();
});

app.engine('html', require('ejs').__express);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views', 'html'));
app.use('/css', express.static(path.join(__dirname, 'views', 'css')));
app.use('/js', express.static(path.join(__dirname, 'views', 'js')));
app.use('/imagens', express.static(path.join(__dirname, 'views', 'imagens')));

// Funçõeszinhas manjadas

async function renderizarTarefas(req, res, dadosExtras = {}) {
  const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : '';
  const usuarioId = Number(req.user.id);
  const categorias = await prisma.categoria.findMany({
    where: { usuarioId },
    orderBy: { nome: 'asc' }
  });
  const filtroCategoriaSolicitado = typeof req.query.categoriaId === 'string'
    ? req.query.categoriaId
    : '';
  const filtroCategoriaValido = filtroCategoriaSolicitado === 'sem-categoria' ||
    categorias.some((categoria) => String(categoria.id) === filtroCategoriaSolicitado);
  const filtroCategoria = filtroCategoriaValido ? filtroCategoriaSolicitado : '';
  const ordenacao = ['prioridade', 'alfabetica', 'data'].includes(req.query.ordenacao)
    ? req.query.ordenacao
    : 'prioridade';
  const direcao = req.query.direcao === 'asc' ? 'asc' : 'desc';
  const where = {
    usuarioId,
    ...(busca ? { titulo: { contains: busca } } : {}),
    ...(filtroCategoria === 'sem-categoria'
      ? { categoriaId: null }
      : filtroCategoria
        ? { categoriaId: Number(filtroCategoria) }
        : {})
  };
  const tarefas = await prisma.tarefa.findMany({
    include: { categoria: true },
    where,
    orderBy: { criadaEm: 'desc' }
  });

  const direction = direcao === 'asc' ? 1 : -1;
  tarefas.sort((a, b) => {
    let comparison;

    if (ordenacao === 'prioridade') {
      comparison = ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade];
      if (direcao === 'asc') comparison *= -1;
    } else if (ordenacao === 'alfabetica') {
      comparison = a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' });
      if (direcao === 'asc') comparison *= -1;
    } else {
      comparison = a.criadaEm.getTime() - b.criadaEm.getTime();
      comparison *= direction;
    }

    return comparison || b.criadaEm.getTime() - a.criadaEm.getTime();
  });

  const sucesso = typeof req.query.sucesso === 'string'
    ? mensagensSucesso[req.query.sucesso] || null
    : null;

  res.render('index.html', {
    tarefas,
    categorias,
    busca,
    filtroCategoria,
    ordenacao,
    direcao,
    sucesso,
    erro: null,
    formulario: { titulo: '', descricao: '', prioridade: 'media', categoriaId: '' },
    ...dadosExtras
  });
}

async function renderizarCategorias(req, res, dadosExtras = {}) {
  const usuarioId = Number(req.user.id);
  const categorias = await prisma.categoria.findMany({
    where: { usuarioId },
    include: { _count: { select: { tarefas: true } } },
    orderBy: { nome: 'asc' }
  });
  const sucesso = typeof req.query.sucesso === 'string'
    ? mensagensSucesso[req.query.sucesso] || null
    : null;
  res.render('categorias.html', {
    categorias,
    sucesso,
    erro: null,
    categoriaNome: '',
    ...dadosExtras
  });
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function lerFormularioTarefa(body = {}) {
  return {
    titulo: typeof body.titulo === 'string' ? body.titulo.trim() : '',
    descricao: typeof body.descricao === 'string' ? body.descricao.trim() : '',
    prioridade: typeof body.prioridade === 'string' ? body.prioridade : '',
    categoriaId: typeof body.categoriaId === 'string' ? body.categoriaId : ''
  };
}

async function validarCategoriaTarefa(categoriaIdFormulario, usuarioId) {
  if (!categoriaIdFormulario) return { categoriaId: null, erro: null };

  const categoriaId = idValido(categoriaIdFormulario);
  if (!categoriaId) {
    return { categoriaId: null, erro: 'Selecione uma categoria válida.' };
  }

  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, usuarioId },
    select: { id: true }
  });
  return categoria
    ? { categoriaId: categoria.id, erro: null }
    : { categoriaId: null, erro: 'Selecione uma categoria válida.' };
}

// SATOR AREPO TENET OPERA [ROTAS]... trocadilho bacana, não?

app.get('/', (req, res) => res.redirect('/tarefas'));

// CRUD de tarefas

app.get('/tarefas', autenticarJWT, async (req, res) => {
  try {
    await renderizarTarefas(req, res);
  } catch (erro) {
    console.error('Erro ao carregar tarefas:', erro);
    res.status(500).send('Erro ao carregar tarefas.');
  }
});

app.post('/tarefas', autenticarJWT, async (req, res) => {
  const formulario = lerFormularioTarefa(req.body);
  const erroFormulario = !formulario.titulo
    ? 'Informe o título da tarefa.'
    : !prioridades.has(formulario.prioridade)
      ? 'Selecione um nível de prioridade válido.'
      : null;

  try {
    const categoriaValidada = await validarCategoriaTarefa(
      formulario.categoriaId,
      Number(req.user.id)
    );
    if (erroFormulario || categoriaValidada.erro) {
      res.status(400);
      return renderizarTarefas(req, res, {
        erro: erroFormulario || categoriaValidada.erro,
        formulario
      });
    }

    await prisma.tarefa.create({
      data: {
        titulo: formulario.titulo,
        descricao: formulario.descricao,
        prioridade: formulario.prioridade,
        categoriaId: categoriaValidada.categoriaId,
        usuarioId: Number(req.user.id)
      }
    });
    res.redirect('/tarefas?sucesso=criada');
  } catch (erro) {
    console.error('Erro ao criar tarefa:', erro);
    res.status(500).send('Erro ao criar tarefa.');
  }
});

app.get('/tarefas/:id/editar', autenticarJWT, async (req, res) => {
  try {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).send('Tarefa não encontrada.');

    const tarefa = await prisma.tarefa.findFirst({
      where: { id, usuarioId: Number(req.user.id) }
    });
    if (!tarefa) return res.status(404).send('Tarefa não encontrada.');

    const categorias = await prisma.categoria.findMany({
      where: { usuarioId: Number(req.user.id) },
      orderBy: { nome: 'asc' }
    });
    res.render('editar-tarefa.html', { tarefa, categorias });
  } catch (erro) {
    console.error('Erro ao carregar tarefa para edição:', erro);
    res.status(500).send('Erro ao carregar tarefa.');
  }
});

app.put('/tarefas/:id', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).send('Tarefa não encontrada.');

  const formulario = lerFormularioTarefa(req.body);
  if (!formulario.titulo || !prioridades.has(formulario.prioridade)) {
    return res.status(400).send('Informe um título e uma prioridade válida.');
  }

  try {
    const categoriaValidada = await validarCategoriaTarefa(
      formulario.categoriaId,
      Number(req.user.id)
    );
    if (categoriaValidada.erro) {
      return res.status(400).send(categoriaValidada.erro);
    }

    const resultado = await prisma.tarefa.updateMany({
      where: { id, usuarioId: Number(req.user.id) },
      data: {
        titulo: formulario.titulo,
        descricao: formulario.descricao,
        prioridade: formulario.prioridade,
        categoriaId: categoriaValidada.categoriaId
      }
    });
    if (resultado.count === 0) return res.status(404).send('Tarefa não encontrada.');
    res.redirect('/tarefas?sucesso=atualizada');
  } catch (erro) {
    console.error('Erro ao atualizar tarefa:', erro);
    res.status(500).send('Erro ao atualizar tarefa.');
  }
});

app.delete('/tarefas/:id', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).send('Tarefa não encontrada.');

  try {
    const resultado = await prisma.tarefa.deleteMany({
      where: { id, usuarioId: Number(req.user.id) }
    });
    if (resultado.count === 0) return res.status(404).send('Tarefa não encontrada.');
    res.redirect('/tarefas?sucesso=excluida');
  } catch (erro) {
    console.error('Erro ao excluir tarefa:', erro);
    res.status(500).send('Erro ao excluir tarefa.');
  }
});

app.patch('/tarefas/:id/conclusao', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).send('Tarefa não encontrada.');

  const concluida = req.body.concluida === 'true';
  try {
    const resultado = await prisma.tarefa.updateMany({
      where: { id, usuarioId: Number(req.user.id) },
      data: { concluida }
    });
    if (resultado.count === 0) return res.status(404).send('Tarefa não encontrada.');
    res.redirect(`/tarefas?sucesso=${concluida ? 'concluida' : 'reaberta'}`);
  } catch (erro) {
    console.error('Erro ao atualizar conclusão da tarefa:', erro);
    res.status(500).send('Erro ao atualizar tarefa.');
  }
});

// CRUD de categorias

app.get('/categorias', autenticarJWT, async (req, res) => {
  try {
    await renderizarCategorias(req, res);
  } catch (erro) {
    console.error('Erro ao carregar categorias:', erro);
    res.status(500).send('Erro ao carregar categorias.');
  }
});

app.post('/categorias', autenticarJWT, async (req, res) => {
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const usuarioId = Number(req.user.id);

  try {
    if (!nome || nome.length > 50) {
      return res.status(400).render('categorias.html', {
        categorias: await prisma.categoria.findMany({
          where: { usuarioId },
          include: { _count: { select: { tarefas: true } } },
          orderBy: { nome: 'asc' }
        }),
        erro: 'Informe um nome de até 50 caracteres.',
        sucesso: null,
        categoriaNome: nome
      });
    }

    await prisma.categoria.create({ data: { nome, usuarioId } });
    res.redirect('/categorias?sucesso=categoriaCriada');
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).render('categorias.html', {
        categorias: await prisma.categoria.findMany({
          where: { usuarioId },
          include: { _count: { select: { tarefas: true } } },
          orderBy: { nome: 'asc' }
        }),
        erro: 'Esta categoria já existe.',
        sucesso: null,
        categoriaNome: nome
      });
    }
    console.error('Erro ao criar categoria:', erro);
    res.status(500).send('Erro ao criar categoria.');
  }
});

app.put('/categorias/:id', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  if (!id) return res.status(404).send('Categoria não encontrada.');
  if (!nome || nome.length > 50) {
    return res.status(400).send('Informe um nome de até 50 caracteres.');
  }

  try {
    const resultado = await prisma.categoria.updateMany({
      where: { id, usuarioId: Number(req.user.id) },
      data: { nome }
    });
    if (resultado.count === 0) return res.status(404).send('Categoria não encontrada.');
    res.redirect('/categorias?sucesso=categoriaAtualizada');
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).send('Você já tem uma categoria com esse nome.');
    }
    console.error('Erro ao atualizar categoria:', erro);
    res.status(500).send('Erro ao atualizar categoria.');
  }
});

app.delete('/categorias/:id', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).send('Categoria não encontrada.');

  try {
    const resultado = await prisma.categoria.deleteMany({
      where: { id, usuarioId: Number(req.user.id) }
    });
    if (resultado.count === 0) return res.status(404).send('Categoria não encontrada.');
    res.redirect('/categorias?sucesso=categoriaExcluida');
  } catch (erro) {
    console.error('Erro ao excluir categoria:', erro);
    res.status(500).send('Erro ao excluir categoria.');
  }
});

// Manipulação e autenticação do usuário

app.get('/cadastro', (req, res) => {
  if (req.user) return res.redirect('/tarefas');
  res.render('cadastro.html', { erro: null, sucesso: null });
});

app.post('/cadastrar-usuario', async (req, res) => {
  const { nome, email, senha, confirmarSenha } = req.body;

  try {
    if (!nome || !email || !senha || !confirmarSenha) {
      return res.render('cadastro.html', {
        erro: 'Preencha todos os campos.',
        sucesso: null
      });
    }
    if (senha !== confirmarSenha) {
      return res.render('cadastro.html', {
        erro: 'As senhas não coincidem.',
        sucesso: null
      });
    }
    if (senha.length < 6) {
      return res.render('cadastro.html', {
        erro: 'A senha deve ter no mínimo 6 caracteres.',
        sucesso: null
      });
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return res.render('cadastro.html', {
        erro: 'Este e-mail já está cadastrado.',
        sucesso: null
      });
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    await prisma.usuario.create({
      data: { nome, email, senha: senhaHash }
    });

    return res.redirect('/login?cadastro=ok');
  } catch (erro) {
    console.error('Erro ao cadastrar usuário:', erro);
    return res.status(500).render('cadastro.html', {
      erro: 'Erro ao cadastrar usuário. Tente novamente.',
      sucesso: null
    });
  }
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/tarefas');
  const sucesso = req.query.cadastro === 'ok'
    ? 'Conta criada com sucesso! Faça login para continuar.'
    : null;
  res.render('login.html', { erro: null, sucesso });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.render('login.html', {
        erro: 'E-mail ou senha inválidos.',
        sucesso: null
      });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.cookie('token', token, { httpOnly: true, secure: false });
    res.redirect('/tarefas');
  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).render('login.html', {
      erro: 'Erro ao fazer login.',
      sucesso: null
    });
  }
});

app.get('/editar-perfil', autenticarJWT, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: Number(req.user.id) },
      select: { id: true, nome: true, email: true }
    });
    if (!usuario) return res.status(404).send('Usuário não encontrado.');

    res.render('editar-perfil.html', { usuario, erro: null, sucesso: null });
  } catch (erro) {
    console.error('Erro ao carregar perfil:', erro);
    res.status(500).send('Erro ao carregar perfil.');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.put('/usuarios/:id', autenticarJWT, async (req, res) => {
  const id = idValido(req.params.id);
  const idUsuarioLogado = Number(req.user.id);
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const confirmarSenha = typeof req.body.confirmarSenha === 'string'
    ? req.body.confirmarSenha
    : '';
  const usuarioFormulario = { id: idUsuarioLogado, nome, email };

  if (!id || id !== idUsuarioLogado) {
    return res.status(404).send('Usuário não encontrado.');
  }

  const erroValidacao = !nome || !email
    ? 'Nome e e-mail são obrigatórios.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Informe um endereço de e-mail válido.'
      : senha && senha.length < 6
        ? 'A senha deve ter no mínimo 6 caracteres.'
        : senha !== confirmarSenha
          ? 'A confirmação da senha não corresponde.'
          : !senha && confirmarSenha
            ? 'Informe a nova senha para confirmar a alteração.'
            : null;

  try {
    if (erroValidacao) {
      return res.status(400).render('editar-perfil.html', {
        usuario: usuarioFormulario,
        erro: erroValidacao,
        sucesso: null
      });
    }

    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
    if (usuarioExistente && usuarioExistente.id !== idUsuarioLogado) {
      return res.status(400).render('editar-perfil.html', {
        usuario: usuarioFormulario,
        erro: 'Este e-mail já está cadastrado.',
        sucesso: null
      });
    }

    const dadosAtualizados = { nome, email };
    if (senha) dadosAtualizados.senha = await bcrypt.hash(senha, 12);

    const usuario = await prisma.usuario.update({
      where: { id: idUsuarioLogado },
      data: dadosAtualizados,
      select: { id: true, nome: true, email: true }
    });

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    res.cookie('token', token, { httpOnly: true, secure: false });
    res.redirect('/tarefas?sucesso=perfil');
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).render('editar-perfil.html', {
        usuario: usuarioFormulario,
        erro: 'Este e-mail já está cadastrado.',
        sucesso: null
      });
    }
    console.error('Erro ao atualizar perfil:', erro);
    res.status(500).render('editar-perfil.html', {
      usuario: usuarioFormulario,
      erro: 'Erro ao atualizar perfil. Tente novamente.',
      sucesso: null
    });
  }
});

// Bagulho padrão

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).send('Erro interno do servidor');
});

app.listen(port, () => {
  console.log(`Servidor rodando: http://localhost:${port}`);
});
