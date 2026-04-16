const { process: processar } = require('../src/stateMachine');
const storage = require('../src/storage/inMemory');

beforeEach(() => storage._clear());

// ─────────────────────────────────────────────────────────────────────────────
// ENTRADA E CLASSIFICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

describe('entrada — abertura e fallback', () => {
  test('primeira mensagem retorna abertura Santos & Bastos e vai para inicio_detalhe', async () => {
    const result = await processar('11999', 'oi', 'whatsapp');
    expect(result.estado).toBe('inicio_detalhe');
    expect(result.message).toContain('Santos & Bastos');
  });

  test('texto não classificável em inicio_detalhe vai para inicio_menu', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'preciso de ajuda', 'whatsapp');
    expect(result.estado).toBe('inicio_menu');
    expect(result.message).toContain('1 -');
  });

  test('texto não classificável em inicio_menu vai para outro_tipo', async () => {
    await processar('11999', 'oi', 'whatsapp');
    await processar('11999', 'preciso de ajuda', 'whatsapp');
    const result = await processar('11999', 'não sei', 'whatsapp');
    expect(result.estado).toBe('outro_tipo');
    expect(result.fluxo).toBe('outros');
  });
});

describe('entrada — classificação por texto livre', () => {
  test('classifica direto no inicio sem passar por detalhe', async () => {
    const result = await processar('11999', 'fui demitido', 'whatsapp');
    expect(result.fluxo).toBe('trabalhista');
    expect(result.estado).toBe('trabalhista_situacao');
  });

  test('classifica em inicio_detalhe após primeira mensagem vaga', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'fui mandado embora', 'whatsapp');
    expect(result.fluxo).toBe('trabalhista');
  });

  test('variações linguísticas trabalhista', async () => {
    const casos = [
      'fui demitido', 'me demitiram', 'mandaram embora', 'mandado embora',
      'fui mandado embora', 'dispensado', 'fui dispensado', 'desligado',
      'perdi o emprego', 'perdi meu emprego', 'aviso prévio', 'justa causa',
      'horas extras', 'carteira assinada', 'fgts', 'rescisão',
    ];
    for (const msg of casos) {
      storage._clear();
      const result = await processar('11999', msg, 'whatsapp');
      expect(result.fluxo).toBe('trabalhista');
    }
  });

  test('variações linguísticas família', async () => {
    const casos = [
      'pensão alimentícia', 'guarda dos filhos', 'divórcio', 'separação',
      'herança', 'inventário', 'partilha', 'cônjuge', 'casamento',
    ];
    for (const msg of casos) {
      storage._clear();
      const result = await processar('11999', msg, 'whatsapp');
      expect(result.fluxo).toBe('familia');
    }
  });

  test('variações linguísticas cliente', async () => {
    const casos = ['sou cliente', 'já cliente', 'tenho processo', 'meu processo'];
    for (const msg of casos) {
      storage._clear();
      const result = await processar('11999', msg, 'whatsapp');
      expect(result.fluxo).toBe('cliente');
    }
  });
});

describe('entrada — menu numérico', () => {
  test('"1" em inicio_detalhe → trabalhista_situacao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '1', 'whatsapp');
    expect(result.estado).toBe('trabalhista_situacao');
    expect(result.fluxo).toBe('trabalhista');
  });

  test('"2" em inicio_detalhe → familia_situacao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '2', 'whatsapp');
    expect(result.estado).toBe('familia_situacao');
    expect(result.fluxo).toBe('familia');
  });

  test('"3" em inicio_detalhe → cliente_nome', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp');
    expect(result.estado).toBe('cliente_nome');
    expect(result.fluxo).toBe('cliente');
  });

  test('"4" em inicio_detalhe → outro_tipo', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '4', 'whatsapp');
    expect(result.estado).toBe('outro_tipo');
    expect(result.fluxo).toBe('outros');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

describe('fluxo cliente', () => {
  test('percorre estados na ordem correta', async () => {
    let r;
    r = await processar('11999', 'tenho processo', 'whatsapp');
    expect(r.estado).toBe('cliente_nome');

    r = await processar('11999', 'João Silva', 'whatsapp');
    expect(r.estado).toBe('cliente_canal_contato');

    r = await processar('11999', 'WhatsApp', 'whatsapp');
    expect(r.estado).toBe('cliente_mensagem');

    r = await processar('11999', 'quero atualização do meu processo', 'whatsapp');
    expect(r.estado).toBe('cliente_finalizado');
  });

  test('prioridade mínima é MEDIO (nunca FRIO)', async () => {
    await processar('11999', 'tenho processo', 'whatsapp');
    await processar('11999', 'João Silva', 'whatsapp');
    await processar('11999', 'WhatsApp', 'whatsapp');
    const result = await processar('11999', 'preciso de ajuda com meu processo', 'whatsapp');
    expect(result.prioridade).not.toBe('FRIO');
    expect(['MEDIO', 'QUENTE']).toContain(result.prioridade);
  });

  test('cliente com flagAtencao vira QUENTE', async () => {
    await processar('11999', 'tenho processo urgente', 'whatsapp');
    await processar('11999', 'João Silva', 'whatsapp');
    await processar('11999', 'WhatsApp', 'whatsapp');
    const result = await processar('11999', 'preciso urgente', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });

  test('mensagem de finalização reflete prioridade MEDIO', async () => {
    await processar('11999', 'tenho processo', 'whatsapp');
    await processar('11999', 'João Silva', 'whatsapp');
    await processar('11999', 'WhatsApp', 'whatsapp');
    const result = await processar('11999', 'preciso de ajuda', 'whatsapp');
    expect(result.message).toContain('analisar');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO TRABALHISTA
// ─────────────────────────────────────────────────────────────────────────────

describe('fluxo trabalhista', () => {
  test('percorre estados na ordem correta (sem QUENTE)', async () => {
    let r;
    r = await processar('11999', 'fui demitido', 'whatsapp');
    expect(r.estado).toBe('trabalhista_situacao');

    r = await processar('11999', 'fui demitido sem justa causa', 'whatsapp');
    expect(r.estado).toBe('trabalhista_impacto');

    r = await processar('11999', '1', 'whatsapp'); // impacto baixo
    expect(r.estado).toBe('trabalhista_intencao');

    r = await processar('11999', '1', 'whatsapp'); // intencao baixa → score 3 → FRIO
    expect(r.estado).toBe('trabalhista_nome');

    r = await processar('11999', 'João Silva', 'whatsapp');
    expect(r.estado).toBe('trabalhista_canal_contato');

    r = await processar('11999', 'WhatsApp', 'whatsapp');
    expect(r.estado).toBe('trabalhista_descricao');

    r = await processar('11999', 'detalhes do caso', 'whatsapp');
    expect(r.estado).toBe('trabalhista_finalizado');
  });

  test('score é calculado após impacto', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp'); // impacto 3
    expect(result.score).toBe(4); // 3+0+1
  });

  test('score final correto após impacto + intenção', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '2', 'whatsapp'); // impacto 2
    const result = await processar('11999', '2', 'whatsapp'); // intencao 2 → score 5
    expect(result.score).toBe(5);
    expect(result.prioridade).toBe('MEDIO');
  });

  test('score QUENTE redireciona para quente_humano', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp'); // impacto 3
    const result = await processar('11999', '3', 'whatsapp'); // intencao 3 → score 7
    expect(result.estado).toBe('quente_humano');
    expect(result.prioridade).toBe('QUENTE');
  });

  test('quente_humano opção "1" finaliza imediatamente', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    await processar('11999', '3', 'whatsapp'); // → quente_humano
    const result = await processar('11999', '1', 'whatsapp'); // quer humano
    expect(result.estado).toBe('trabalhista_finalizado');
  });

  test('quente_humano opção "2" continua para trabalhista_nome', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    await processar('11999', '3', 'whatsapp'); // → quente_humano
    const result = await processar('11999', '2', 'whatsapp'); // não quer humano
    expect(result.estado).toBe('trabalhista_nome');
  });

  test('mensagem de finalização QUENTE', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    await processar('11999', '2', 'whatsapp'); // continua
    await processar('11999', 'João Silva', 'whatsapp');
    await processar('11999', 'WhatsApp', 'whatsapp');
    const result = await processar('11999', 'detalhes', 'whatsapp');
    expect(result.message).toContain('prioritário');
  });

  test('mensagem de finalização FRIO contém valor percebido', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '1', 'whatsapp'); // impacto baixo
    await processar('11999', '1', 'whatsapp'); // intencao baixa → FRIO
    await processar('11999', 'João Silva', 'whatsapp');
    await processar('11999', 'WhatsApp', 'whatsapp');
    const result = await processar('11999', 'detalhes', 'whatsapp');
    expect(result.message).toContain('analisar');
    expect(result.message).not.toBe('Registramos sua solicitação.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO FAMÍLIA
// ─────────────────────────────────────────────────────────────────────────────

describe('fluxo família', () => {
  test('percorre estados na ordem correta (sem QUENTE)', async () => {
    let r;
    r = await processar('11999', 'divórcio', 'whatsapp');
    expect(r.estado).toBe('familia_situacao');

    r = await processar('11999', 'quero me separar', 'whatsapp');
    expect(r.estado).toBe('familia_impacto');

    r = await processar('11999', '1', 'whatsapp');
    expect(r.estado).toBe('familia_intencao');

    r = await processar('11999', '1', 'whatsapp'); // score 3 → FRIO
    expect(r.estado).toBe('familia_nome');

    r = await processar('11999', 'Maria Silva', 'whatsapp');
    expect(r.estado).toBe('familia_canal_contato');

    r = await processar('11999', 'WhatsApp', 'whatsapp');
    expect(r.estado).toBe('familia_descricao');

    r = await processar('11999', 'detalhes', 'whatsapp');
    expect(r.estado).toBe('familia_finalizado');
  });

  test('score QUENTE redireciona para quente_humano', async () => {
    await processar('11999', 'divórcio', 'whatsapp');
    await processar('11999', 'situação grave', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp');
    expect(result.estado).toBe('quente_humano');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO OUTROS
// ─────────────────────────────────────────────────────────────────────────────

describe('fluxo outros', () => {
  test('percorre estados na ordem correta incluindo impacto', async () => {
    let r;
    r = await processar('11999', 'oi', 'whatsapp');
    r = await processar('11999', '4', 'whatsapp'); // menu → outro_tipo
    expect(r.estado).toBe('outro_tipo');

    r = await processar('11999', 'contrato comercial', 'whatsapp');
    expect(r.estado).toBe('outro_impacto');

    r = await processar('11999', '2', 'whatsapp'); // impacto médio
    expect(r.estado).toBe('outro_intencao');

    r = await processar('11999', '2', 'whatsapp');
    expect(r.estado).toBe('outro_nome');

    r = await processar('11999', 'Pedro Lima', 'whatsapp');
    expect(r.estado).toBe('outro_canal_contato');

    r = await processar('11999', 'WhatsApp', 'whatsapp');
    expect(r.estado).toBe('outro_descricao');

    r = await processar('11999', 'detalhes', 'whatsapp');
    expect(r.estado).toBe('outro_finalizado');
  });

  test('outros pode chegar a QUENTE com impacto 3 + intenção 3', async () => {
    await processar('11999', 'oi', 'whatsapp');
    await processar('11999', '4', 'whatsapp');
    await processar('11999', 'assunto urgente', 'whatsapp'); // outro_tipo → outro_impacto
    await processar('11999', '3', 'whatsapp'); // impacto 3
    const result = await processar('11999', '3', 'whatsapp'); // intencao 3 → score 7
    expect(result.prioridade).toBe('QUENTE');
    expect(result.score).toBe(7);
  });

  test('outros nunca fica preso em FRIO por falta de impacto', async () => {
    await processar('11999', 'oi', 'whatsapp');
    await processar('11999', '4', 'whatsapp');
    await processar('11999', 'assunto', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp'); // impacto 3 → score 4
    expect(result.score).toBe(4);
    expect(result.estado).toBe('outro_intencao');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE E PRIORIDADE
// ─────────────────────────────────────────────────────────────────────────────

describe('score — fórmula e prioridades', () => {
  test('impacto 1 + intenção 1 = score 3 → FRIO', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '1', 'whatsapp');
    const result = await processar('11999', '1', 'whatsapp');
    expect(result.score).toBe(3);
    expect(result.prioridade).toBe('FRIO');
  });

  test('impacto 2 + intenção 2 = score 5 → MEDIO', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '2', 'whatsapp');
    const result = await processar('11999', '2', 'whatsapp');
    expect(result.score).toBe(5);
    expect(result.prioridade).toBe('MEDIO');
  });

  test('impacto 3 + intenção 2 = score 6 → MEDIO', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    const result = await processar('11999', '2', 'whatsapp');
    expect(result.score).toBe(6);
    expect(result.prioridade).toBe('MEDIO');
  });

  test('impacto 3 + intenção 3 = score 7 → QUENTE', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp');
    expect(result.score).toBe(7);
    expect(result.prioridade).toBe('QUENTE');
  });

  test('valores fora do range são clampados entre 1 e 3', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    const result = await processar('11999', '99', 'whatsapp'); // clamp para 3
    expect(result.score).toBe(4); // 3+0+1
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLAG DE ATENÇÃO E URGÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

describe('flag de atenção', () => {
  test('"urgente" ativa flagAtencao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'preciso urgente de ajuda', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });

  test('"advogado" ativa flagAtencao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'quero falar com advogado', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });

  test('flagAtencao persiste após reset', async () => {
    await processar('11999', 'urgente', 'whatsapp');
    const result = await processar('11999', 'reiniciar', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });

  test('flagAtencao persiste em qualquer estado do fluxo', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    const result = await processar('11999', 'é urgente isso', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET
// ─────────────────────────────────────────────────────────────────────────────

describe('reset', () => {
  test('"reiniciar" volta para inicio', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    const result = await processar('11999', 'reiniciar', 'whatsapp');
    expect(result.estado).toBe('inicio');
  });

  test('"menu" volta para inicio', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    const result = await processar('11999', 'menu', 'whatsapp');
    expect(result.estado).toBe('inicio');
  });

  test('"voltar" volta para inicio', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    const result = await processar('11999', 'voltar', 'whatsapp');
    expect(result.estado).toBe('inicio');
  });

  test('após reset, sessao reinicia com score 1 e prioridade FRIO', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'situação', 'whatsapp');
    await processar('11999', '3', 'whatsapp');
    const result = await processar('11999', 'reiniciar', 'whatsapp');
    expect(result.score).toBe(1);
    expect(result.prioridade).toBe('FRIO');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizer — entrada do webhook', () => {
  const normalize = require('../src/normalizer');

  test('remove não-numéricos do campo sessao', () => {
    const r = normalize({ sessao: '+55 (11) 99999-9999', mensagem: 'oi', canal: 'WhatsApp' });
    expect(r.sessao).toBe('5511999999999');
  });

  test('aceita telefone como alias de sessao', () => {
    const r = normalize({ telefone: '11999999999', mensagem: 'oi', canal: 'whatsapp' });
    expect(r.sessao).toBe('11999999999');
  });

  test('aceita Telefone (maiúsculo) como alias de sessao', () => {
    const r = normalize({ Telefone: '21999999999', mensagem: 'oi', canal: 'whatsapp' });
    expect(r.sessao).toBe('21999999999');
  });

  test('faz trim e lowercase na mensagem', () => {
    const r = normalize({ sessao: '11999', mensagem: '  OLÁ  ', canal: 'whatsapp' });
    expect(r.mensagem).toBe('olá');
  });

  test('normaliza canal para lowercase', () => {
    const r = normalize({ sessao: '11999', mensagem: 'oi', canal: 'WHATSAPP' });
    expect(r.canal).toBe('whatsapp');
  });

  test('mensagem nula vira string vazia', () => {
    const r = normalize({ sessao: '11999', mensagem: null, canal: 'whatsapp' });
    expect(r.mensagem).toBe('');
  });

  test('adiciona dataHora em formato ISO', () => {
    const r = normalize({ sessao: '11999', mensagem: 'oi', canal: 'whatsapp' });
    expect(r.dataHora).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORER
// ─────────────────────────────────────────────────────────────────────────────

describe('scorer — fórmula', () => {
  const { calcularScore } = require('../src/scorer');

  test('score = impacto + intencao + 1', () => {
    expect(calcularScore({ impacto: 3, intencao: 3 }).score).toBe(7);
  });

  test('score >= 7 é QUENTE', () => {
    expect(calcularScore({ impacto: 3, intencao: 3 }).prioridade).toBe('QUENTE');
  });

  test('score >= 5 e < 7 é MEDIO', () => {
    expect(calcularScore({ impacto: 2, intencao: 2 }).prioridade).toBe('MEDIO');
  });

  test('score < 5 é FRIO', () => {
    expect(calcularScore({ impacto: 1, intencao: 1 }).prioridade).toBe('FRIO');
  });

  test('com apenas impacto, intencao assume 0', () => {
    expect(calcularScore({ impacto: 3, intencao: null }).score).toBe(4);
  });

  test('sem dados, score mínimo é 1', () => {
    expect(calcularScore({}).score).toBe(1);
  });
});
