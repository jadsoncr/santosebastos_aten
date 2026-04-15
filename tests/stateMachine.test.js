const { process: processar } = require('../src/stateMachine');
const storage = require('../src/storage/inMemory');

beforeEach(() => storage._clear());

describe('stateMachine — inicio', () => {
  test('estado inicio retorna mensagem de boas-vindas', async () => {
    const result = await processar('11999', 'oi', 'whatsapp');
    expect(result.estado).toBe('inicio');
    expect(result.message).toContain('Digite');
  });

  test('"1" no inicio direciona para cliente_nome', async () => {
    await processar('11999', 'oi', 'whatsapp'); // inicializa sessão
    const result = await processar('11999', '1', 'whatsapp');
    expect(result.estado).toBe('cliente_nome');
    expect(result.fluxo).toBe('cliente');
  });

  test('"2" no inicio direciona para trabalhista_situacao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '2', 'whatsapp');
    expect(result.estado).toBe('trabalhista_situacao');
    expect(result.fluxo).toBe('trabalhista');
  });

  test('"3" no inicio direciona para familia_situacao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '3', 'whatsapp');
    expect(result.estado).toBe('familia_situacao');
  });

  test('"4" no inicio direciona para outro_tipo', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', '4', 'whatsapp');
    expect(result.estado).toBe('outro_tipo');
  });

  test('texto "demitido" no inicio vai para trabalhista', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'fui demitido', 'whatsapp');
    expect(result.fluxo).toBe('trabalhista');
  });

  test('"reiniciar" reseta o estado', async () => {
    await processar('11999', 'oi', 'whatsapp');
    await processar('11999', '2', 'whatsapp'); // entra em trabalhista
    const result = await processar('11999', 'reiniciar', 'whatsapp');
    expect(result.estado).toBe('inicio');
  });
});

describe('stateMachine — score incremental', () => {
  test('score é atualizado após coleta de impacto', async () => {
    await processar('11999', 'oi', 'whatsapp');
    await processar('11999', '2', 'whatsapp'); // trabalhista_situacao
    await processar('11999', 'fui demitido sem justa causa', 'whatsapp'); // trabalhista_impacto
    const result = await processar('11999', '3', 'whatsapp'); // impacto = 3
    expect(result.score).toBeGreaterThan(1);
  });
});

describe('stateMachine — flag de atenção', () => {
  test('mensagem com "urgente" ativa flagAtencao', async () => {
    await processar('11999', 'oi', 'whatsapp');
    const result = await processar('11999', 'preciso urgente de ajuda', 'whatsapp');
    expect(result.flagAtencao).toBe(true);
  });
});
