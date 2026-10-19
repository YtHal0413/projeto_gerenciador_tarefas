require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

const hashSenhas = async () => {
    const usuarios = await prisma.usuario.findMany();
    for (const u of usuarios) {
        if (!u.senha.startsWith('$2')) {
            const hasheada = await bcrypt.hash(u.senha, 12);
            await u.update({
                data: { senha: hasheada }
            });
            console.log(`Usuario ${u.id} criptografado.`);
        }
    }
    console.log('Hash completo.');
    process.exit(0);
};

hashSenhas();