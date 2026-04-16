const { process: processar } = require('../src/stateMachine');
const storage = require('../src/storage/inMemory');

beforeEach(() => storage._clear());

describe('stateMachine — inicio', () => {
  test('primeira mensagem retorna abertura e vai para inicio_detalhe', async () => {
    const result = await processar('11999', 'oi', 'whatsapp');
    expect(result.estado).toBe('inicio_detalhe');
    expect(result.message).toContain('Santos & Bastos');
  });

  test('texto "fui demitido" no inicio classifica direto para trabalhista', async () => {
    const result = await processar('11999', 'fui demitido', 'whatsapp');
    expect(result.fluxo).toBe('trabalhista');
    expect(result.estado).toBe('trabalhista_situacao');
  });

  test('texto "pensão alimentícia" no inicio classifica direto para familia', async () => {
    const result = await processar('11999', 'pensão alimentícia', 'whatsapp');
    expect(result.fluxo).toBe('familia');
  });

  test('texto não classificável vai para inicio_detalhe, depois para inicio_menu', async () => {
    await processar('11999', 'oi', 'whatsapp'); // → inicio_detalhe
    const result = await processar('11999', 'preciso de ajuda', 'whatsapp'); // ainda não classifica
    expect(result.estado).toBe('inicio_menu');
  });

  test('menu numérico funciona a partir de inicio_detalhe', async () => {
    await processar('11999', 'oi', 'whatsapp'); // → inicio_detalhe
    const result = await processar('11999', '2', 'whatsapp'); // menu: trabalhista
    expect(result.estado).toBe('trabalhista_situacao');
    expect(result.fluxo).toBe('trabalhista');
  });

  test('menu "1" funciona a partir de inicio_detalhe', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '1', 'whatsapp');
    expect(result.estado).toBe('cliente_nome');
    expect(result.fluxo).toBe('cliente');
  });

  test('menu "3" funciona a partir de inicio_detalhe', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp');
    expect(result.estado).toBe('familia_situacao');
  });

  test('menu "4" funciona a partir de inicio_detalhe', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '4', 'whatsapp');
    expect(result.estado).toBe('outro_tipo');
  });

  test('"reiniciar" reseta o estado', async () => {
    await processar('11999', 'fui demitido', 'whatsapp'); // entra em trabalhista
    const result = await processar('11999', 'reiniciar', 'whatsapp');
    expect(result.estado).toBe('inicio');
  });

  test('variações linguísticas reais classificam corretamente', async () => {
    const casos = [
      { msg: 'me mandaram embora', fluxo: 'trabalhista' },
      { msg: 'fui dispensado', fluxo: 'trabalhista' },
      { msg: 'perdi meu emprego', fluxo: 'trabalhista' },
      { msg: 'quero saber sobre guarda dos filhos', fluxo: 'familia' },
      { msg: 'tenho processo', fluxo: 'cliente' },
    ];
    for (const { msg, fluxo } of casos) {
      storage._clear();
      const result = await processar('11999', msg, 'whatsapp');
      expect(result.fluxo).toBe(fluxo);
    }
  });
});

describe('stateMachine — score incremental', () => {
  test('score é atualizado após coleta de impacto', async () => {
    await processar('11999', 'fui demitido', 'whatsapp'); // → trabalhista_situacao
    await processar('11999', 'fui demitido sem justa causa', 'whatsapp'); // → trabalhista_impacto
    const result = await processar('11999', '3', 'whatsapp'); // impacto = 3
    expect(result.score).toBeGreaterThan(1);
  });

  test('score QUENTE direciona para quente_humano', async () => {
    await processar('11999', 'fui demitido', 'whatsapp');
    await processar('11999', 'fui demitido sem justa causa', 'whatsapp');
    await processar('11999', '3', 'whatsapp'); // impacto 3
    const result = await processar('11999', '3', 'whatsapp'); // intencao 3 → score 3+3+1=7 → QUENTE
    expect(result.estado).toBe('quente_humano');
  });
});

describe('stateMachine — flag de atenção', () => {
  test('mensagem com "urgente" ativa flagAtencao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'preciso urgente de ajuda', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });
});
