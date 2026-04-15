// src/stateMachine.js
const sessionManager = require('./sessionManager');
const { calcularScore } = require('./scorer');
const storage = require('./storage');

const RESET_KEYWORDS = ['menu', 'reiniciar', 'voltar'];
const URGENT_KEYWORDS = ['urgente', 'advogado', 'falar com alguém', 'falar com alguem'];

// ─── Perguntas por estado ──────────────────────────────────────────────────
const PERGUNTAS = {
  inicio: `Olá. Posso direcionar seu atendimento.\n\nDigite:\n1 - Já sou cliente\n2 - Trabalhista\n3 - Família\n4 - Outro assunto`,

  cliente_nome: 'Qual é o seu nome completo?',
  cliente_canal_preferido: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  cliente_mensagem: 'Descreva brevemente sua solicitação:',
  cliente_finalizado: null,

  trabalhista_situacao: 'Descreva brevemente sua situação trabalhista:',
  trabalhista_impacto: 'Qual o impacto financeiro estimado?\n1 - Baixo\n2 - Médio\n3 - Alto',
  trabalhista_intencao: 'Qual sua intenção?\n1 - Buscar acordo\n2 - Entrar na Justiça\n3 - Ainda não sei',
  trabalhista_nome: 'Qual é o seu nome completo?',
  trabalhista_canal_preferido: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  trabalhista_descricao: 'Descreva mais detalhes do seu caso:',
  trabalhista_finalizado: null,

  familia_situacao: 'Descreva brevemente sua situação familiar:',
  familia_impacto: 'Qual o impacto estimado?\n1 - Baixo\n2 - Médio\n3 - Alto',
  familia_intencao: 'Qual sua intenção?\n1 - Buscar acordo\n2 - Processo judicial\n3 - Ainda não sei',
  familia_nome: 'Qual é o seu nome completo?',
  familia_canal_preferido: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  familia_descricao: 'Descreva mais detalhes do seu caso:',
  familia_finalizado: null,

  outro_tipo: 'Qual tipo de assunto você precisa tratar?',
  outro_intencao: 'Qual sua intenção?\n1 - Informação\n2 - Contratar serviço\n3 - Reclamação',
  outro_nome: 'Qual é o seu nome completo?',
  outro_canal_preferido: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  outro_descricao: 'Descreva sua solicitação:',
  outro_finalizado: null,
};

// ─── Classificação por texto livre ────────────────────────────────────────
function classificarPorTexto(mensagem) {
  if (/sou cliente|já cliente|ja cliente/.test(mensagem)) return 'cliente';
  if (/demitido|empresa|trabalhista|emprego|salário|salario|rescisão|rescisao|fgts/.test(mensagem)) return 'trabalhista';
  if (/guarda|pensão|pensao|divórcio|divorcio|família|familia|cônjuge|conjuge/.test(mensagem)) return 'familia';
  return null;
}

// ─── Detectar urgência ────────────────────────────────────────────────────
function temUrgencia(mensagem) {
  return URGENT_KEYWORDS.some(k => mensagem.includes(k));
}

// ─── Recalcular score na sessão ────────────────────────────────────────────
async function recalcularScore(sessao, dados) {
  const { score, prioridade } = calcularScore({
    impacto: dados.impacto,
    intencao: dados.intencao,
  });
  const flagAtencao = dados.flagAtencao || prioridade === 'QUENTE';
  await sessionManager.updateSession(sessao, { score, prioridade, flagAtencao });
  return { score, prioridade, flagAtencao };
}

// ─── Mensagem de finalização ──────────────────────────────────────────────
function mensagemFinalizacao(prioridade) {
  if (prioridade === 'QUENTE') return 'Seu caso foi identificado como prioritário. Entraremos em contato o mais breve possível.';
  if (prioridade === 'MEDIO') return 'Recebemos suas informações e iremos analisar seu caso.';
  return 'Registramos sua solicitação.';
}

// ─── Persistência por tipo de fluxo ───────────────────────────────────────
async function persistirFluxo(sessao) {
  const s = await storage.getSession(sessao);
  if (!s) return;

  if (s.fluxo === 'cliente') {
    await storage.createClient({
      nome: s.nome,
      telefone: s.sessao,
      tipoSolicitacao: 'Atendimento cliente existente',
      canalOrigem: s.canalOrigem,
      canalPreferido: s.canalPreferido,
      conteudo: s.ultimaMensagem,
      urgencia: s.prioridade,
      status: 'NOVO',
      origem: 'whatsapp-bot',
    });
    return;
  }

  if (s.fluxo === 'trabalhista' || s.fluxo === 'familia') {
    await storage.createLead({
      nome: s.nome,
      telefone: s.sessao,
      area: s.fluxo,
      situacao: s.situacao,
      impacto: s.impacto,
      intencao: s.intencao,
      score: s.score,
      prioridade: s.prioridade,
      canalOrigem: s.canalOrigem,
      canalPreferido: s.canalPreferido,
      resumo: s.ultimaMensagem,
      status: 'NOVO',
      origem: 'whatsapp-bot',
    });
    return;
  }

  await storage.createOther({
    nome: s.nome,
    telefone: s.sessao,
    tipo: s.situacao,
    canalOrigem: s.canalOrigem,
    canalPreferido: s.canalPreferido,
    conteudo: s.ultimaMensagem,
    status: 'NOVO',
    origem: 'whatsapp-bot',
  });
}

// ─── Transições por estado ────────────────────────────────────────────────
async function transitar(sessao, estado, mensagem) {
  switch (estado) {

    // ── INICIO ──
    case 'inicio': {
      let fluxo = null;
      if (mensagem === '1') fluxo = 'cliente';
      else if (mensagem === '2') fluxo = 'trabalhista';
      else if (mensagem === '3') fluxo = 'familia';
      else if (mensagem === '4') fluxo = 'outros';
      else fluxo = classificarPorTexto(mensagem);

      if (!fluxo) return { proximoEstado: 'inicio', salvar: {} };

      const mapaEstado = {
        cliente: 'cliente_nome',
        trabalhista: 'trabalhista_situacao',
        familia: 'familia_situacao',
        outros: 'outro_tipo',
      };
      return { proximoEstado: mapaEstado[fluxo], salvar: { fluxo, area: fluxo } };
    }

    // ── CLIENTE ──
    case 'cliente_nome':
      return { proximoEstado: 'cliente_canal_preferido', salvar: { nome: mensagem } };

    case 'cliente_canal_preferido':
      return { proximoEstado: 'cliente_mensagem', salvar: { canalPreferido: mensagem } };

    case 'cliente_mensagem':
      return { proximoEstado: 'cliente_finalizado', salvar: { ultimaMensagem: mensagem } };

    // ── TRABALHISTA ──
    case 'trabalhista_situacao':
      return { proximoEstado: 'trabalhista_impacto', salvar: { situacao: mensagem } };

    case 'trabalhista_impacto': {
      const impacto = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, impacto });
      return { proximoEstado: 'trabalhista_intencao', salvar: { impacto, ...scoreData } };
    }

    case 'trabalhista_intencao': {
      const intencao = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, intencao });
      return { proximoEstado: 'trabalhista_nome', salvar: { intencao, ...scoreData } };
    }

    case 'trabalhista_nome':
      return { proximoEstado: 'trabalhista_canal_preferido', salvar: { nome: mensagem } };

    case 'trabalhista_canal_preferido':
      return { proximoEstado: 'trabalhista_descricao', salvar: { canalPreferido: mensagem } };

    case 'trabalhista_descricao':
      return { proximoEstado: 'trabalhista_finalizado', salvar: { ultimaMensagem: mensagem } };

    // ── FAMÍLIA ──
    case 'familia_situacao':
      return { proximoEstado: 'familia_impacto', salvar: { situacao: mensagem } };

    case 'familia_impacto': {
      const impacto = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, impacto });
      return { proximoEstado: 'familia_intencao', salvar: { impacto, ...scoreData } };
    }

    case 'familia_intencao': {
      const intencao = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, intencao });
      return { proximoEstado: 'familia_nome', salvar: { intencao, ...scoreData } };
    }

    case 'familia_nome':
      return { proximoEstado: 'familia_canal_preferido', salvar: { nome: mensagem } };

    case 'familia_canal_preferido':
      return { proximoEstado: 'familia_descricao', salvar: { canalPreferido: mensagem } };

    case 'familia_descricao':
      return { proximoEstado: 'familia_finalizado', salvar: { ultimaMensagem: mensagem } };

    // ── OUTROS ──
    case 'outro_tipo':
      return { proximoEstado: 'outro_intencao', salvar: { situacao: mensagem } };

    case 'outro_intencao': {
      const intencao = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, intencao });
      return { proximoEstado: 'outro_nome', salvar: { intencao, ...scoreData } };
    }

    case 'outro_nome':
      return { proximoEstado: 'outro_canal_preferido', salvar: { nome: mensagem } };

    case 'outro_canal_preferido':
      return { proximoEstado: 'outro_descricao', salvar: { canalPreferido: mensagem } };

    case 'outro_descricao':
      return { proximoEstado: 'outro_finalizado', salvar: { ultimaMensagem: mensagem } };

    default:
      return { proximoEstado: estado, salvar: {} };
  }
}

// ─── Ponto de entrada principal ───────────────────────────────────────────
async function process(sessao, mensagem, canal) {
  // 1. Carregar sessão
  let sessaoObj = await sessionManager.getSession(sessao, canal);

  // 2. Detectar urgência em qualquer momento
  const urgente = temUrgencia(mensagem);
  if (urgente && !sessaoObj.flagAtencao) {
    await sessionManager.updateSession(sessao, { flagAtencao: true });
    sessaoObj = { ...sessaoObj, flagAtencao: true };
  }

  // 3. Palavras de reinício
  if (RESET_KEYWORDS.includes(mensagem)) {
    sessaoObj = await sessionManager.resetSession(sessao, canal);
    return {
      message: PERGUNTAS.inicio,
      estado: 'inicio',
      fluxo: null,
      sessao,
      score: 1,
      prioridade: 'FRIO',
      flagAtencao: sessaoObj.flagAtencao,
    };
  }

  // 4. Estado inicio sem mensagem relevante: mostrar menu
  if (sessaoObj.estadoAtual === 'inicio' && !mensagem) {
    return buildResposta(sessaoObj, PERGUNTAS.inicio);
  }

  // 5. Salvar última mensagem
  await sessionManager.updateSession(sessao, { ultimaMensagem: mensagem });

  // 6. Processar transição
  const { proximoEstado, salvar } = await transitar(sessao, sessaoObj.estadoAtual, mensagem);
  await sessionManager.updateSession(sessao, { ...salvar, estadoAtual: proximoEstado });

  // 7. Recarregar sessão atualizada
  const sessaoAtualizada = await storage.getSession(sessao);

  // 8. Finalização
  const finalStates = ['cliente_finalizado', 'trabalhista_finalizado', 'familia_finalizado', 'outro_finalizado'];
  if (finalStates.includes(proximoEstado)) {
    await persistirFluxo(sessao);
    const msg = mensagemFinalizacao(sessaoAtualizada.prioridade);
    await sessionManager.updateSession(sessao, { ultimaPergunta: msg });
    return buildResposta(sessaoAtualizada, msg);
  }

  // 9. Próxima pergunta
  const pergunta = PERGUNTAS[proximoEstado] || PERGUNTAS.inicio;
  await sessionManager.updateSession(sessao, { ultimaPergunta: pergunta });
  return buildResposta(sessaoAtualizada, pergunta);
}

function buildResposta(sessao, message) {
  return {
    message,
    estado: sessao.estadoAtual,
    fluxo: sessao.fluxo,
    sessao: sessao.sessao,
    score: sessao.score,
    prioridade: sessao.prioridade,
    flagAtencao: sessao.flagAtencao || false,
  };
}

module.exports = { process };
