// src/stateMachine.js
const sessionManager = require('./sessionManager');
const { calcularScore } = require('./scorer');
const storage = require('./storage');
const { randomUUID } = require('crypto');

const RESET_KEYWORDS = ['menu', 'reiniciar', 'voltar'];
const URGENT_KEYWORDS = ['urgente', 'advogado', 'falar com alguém', 'falar com alguem'];

// ─── Perguntas por estado ──────────────────────────────────────────────────
const PERGUNTAS = {
  inicio: `Olá! Aqui é do Santos & Bastos Advogados 👋\n\nVou te ajudar a entender seu caso rapidinho.\n\nMe conta em uma frase o que aconteceu:\n_(ex: fui demitido, quero me divorciar, tenho uma dívida...)_`,
  inicio_menu: `Entendi 👍\n\nPra te direcionar melhor, me diz qual dessas opções chega mais perto:\n\n1 - Problema no trabalho\n2 - Questão de família\n3 - Já sou cliente\n4 - Outro assunto`,
  inicio_detalhe: `Pode me explicar um pouco melhor o que está acontecendo?\n_(ex: fui demitido, quero me divorciar, tenho uma dívida...)_`,
  inicio_advogado: `Claro 👍\n\nVocê já é cliente do escritório ou é um caso novo?\n\n1 - Já sou cliente\n2 - É um caso novo`,

  cliente_nome: 'Qual é o seu nome completo?',
  cliente_canal_contato: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  cliente_mensagem: 'Descreva brevemente sua solicitação:',
  cliente_finalizado: null,

  trabalhista_situacao: 'Descreva brevemente sua situação trabalhista:',
  trabalhista_impacto: 'Qual o impacto financeiro estimado?\n1 - Baixo\n2 - Médio\n3 - Alto',
  trabalhista_intencao: 'Qual sua intenção?\n1 - Buscar acordo\n2 - Entrar na Justiça\n3 - Ainda não sei',
  trabalhista_nome: 'Qual é o seu nome completo?',
  trabalhista_canal_contato: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  trabalhista_descricao: 'Descreva mais detalhes do seu caso:',
  trabalhista_finalizado: null,

  familia_situacao: 'Descreva brevemente sua situação familiar:',
  familia_impacto: 'Qual o impacto estimado?\n1 - Baixo\n2 - Médio\n3 - Alto',
  familia_intencao: 'Qual sua intenção?\n1 - Buscar acordo\n2 - Processo judicial\n3 - Ainda não sei',
  familia_nome: 'Qual é o seu nome completo?',
  familia_canal_contato: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  familia_descricao: 'Descreva mais detalhes do seu caso:',
  familia_finalizado: null,

  outro_tipo: 'Qual tipo de assunto você precisa tratar?',
  outro_impacto: 'Qual o nível de urgência?\n1 - Baixo\n2 - Médio\n3 - Alto',
  outro_intencao: 'Qual sua intenção?\n1 - Informação\n2 - Contratar serviço\n3 - Reclamação',
  outro_nome: 'Qual é o seu nome completo?',
  outro_canal_contato: 'Como prefere ser contatado? (WhatsApp / Telefone / E-mail)',
  outro_descricao: 'Descreva sua solicitação:',
  outro_finalizado: null,

  quente_humano: `⚠️ Pelo que você descreveu, seu caso pode precisar de atenção rápida.\n\nPrefere falar diretamente com um advogado agora?\n\n1 - Sim, quero falar com alguém\n2 - Não, continuar aqui`,
};

// ─── Classificação por texto livre ────────────────────────────────────────
function classificarPorTexto(mensagem) {
  if (/quero falar com advogado|falar com advogado|falar com o advogado|preciso de um advogado|quero um advogado/.test(mensagem)) return 'advogado';
  if (/sou cliente|já cliente|ja cliente|tenho processo|meu processo/.test(mensagem)) return 'cliente';
  if (/(demitido|me demitiram|fui demitido|mandaram embora|mandado embora|fui mandado embora|dispensado|fui dispensado|desligado|fui desligado|perdi o emprego|perdi meu emprego|direito trabalhista|causa trabalhista|salário atrasado|salario atrasado|rescisão|rescisao|fgts|aviso prévio|aviso previo|justa causa|horas extras|carteira assinada|assédio no trabalho|acidente de trabalho|férias não pagas|ferias nao pagas)/.test(mensagem)) return 'trabalhista';
  if (/(guarda|pensão|pensao|alimentos|divórcio|divorcio|separação|separacao|família|familia|cônjuge|conjuge|filho|filha|casamento|inventário|inventario|herança|heranca|partilha)/.test(mensagem)) return 'familia';
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
  return 'Recebi suas informações 👍\n\nVamos analisar e te orientar sobre os próximos passos.';
}

// ─── Persistência por tipo de fluxo ───────────────────────────────────────
async function persistirFluxo(sessao) {
  const s = await storage.getSession(sessao);
  if (!s) return;

  const leadId = s.leadId || randomUUID();
  await sessionManager.updateSession(sessao, { leadId });

  let tentativa = 0;
  const MAX = 3;

  while (tentativa < MAX) {
    tentativa++;
    try {
      if (s.fluxo === 'cliente') {
        const prioridadeCliente = s.flagAtencao ? 'QUENTE' : 'MEDIO';
        await sessionManager.updateSession(s.sessao, { prioridade: prioridadeCliente });
        await storage.createClient({
          leadId,
          nome: s.nome,
          telefone: s.sessao,
          tipoSolicitacao: 'Atendimento cliente existente',
          canalOrigem: s.canalOrigem,
          canalPreferido: s.canalPreferido,
          conteudo: s.ultimaMensagem,
          urgencia: prioridadeCliente,
          flagAtencao: s.flagAtencao,
          status: 'NOVO',
          origem: 'whatsapp-bot',
        });
        return;
      }

      if (s.fluxo === 'trabalhista' || s.fluxo === 'familia') {
        await storage.createLead({
          leadId,
          nome: s.nome,
          telefone: s.sessao,
          area: s.fluxo,
          situacao: s.situacao,
          impacto: s.impacto,
          intencao: s.intencao,
          score: s.score,
          prioridade: s.prioridade,
          flagAtencao: s.flagAtencao,
          canalOrigem: s.canalOrigem,
          canalPreferido: s.canalPreferido,
          resumo: s.ultimaMensagem,
          status: 'NOVO',
          origem: 'whatsapp-bot',
        });
        return;
      }

      await storage.createOther({
        leadId,
        nome: s.nome,
        telefone: s.sessao,
        tipo: s.situacao,
        canalOrigem: s.canalOrigem,
        canalPreferido: s.canalPreferido,
        conteudo: s.ultimaMensagem,
        status: 'NOVO',
        origem: 'whatsapp-bot',
      });
      return;

    } catch (err) {
      console.error(`[persistirFluxo tentativa ${tentativa}/${MAX}]`, err.message);
      if (tentativa === MAX) {
        console.error('[persistirFluxo] falha definitiva — lead não persistido:', leadId);
      }
    }
  }
}

// ─── Transições por estado ────────────────────────────────────────────────
async function transitar(sessao, estado, mensagem) {
  switch (estado) {

    // ── INICIO ──
    case 'inicio': {
      let fluxo = null;
      if (mensagem === '1') fluxo = 'trabalhista';
      else if (mensagem === '2') fluxo = 'familia';
      else if (mensagem === '3') fluxo = 'cliente';
      else if (mensagem === '4') fluxo = 'outros';
      else fluxo = classificarPorTexto(mensagem);

      if (fluxo === 'advogado') return { proximoEstado: 'inicio_advogado', salvar: {} };
      if (!fluxo) return { proximoEstado: 'inicio_detalhe', salvar: {} };

      const mapaEstado = {
        cliente: 'cliente_nome',
        trabalhista: 'trabalhista_situacao',
        familia: 'familia_situacao',
        outros: 'outro_tipo',
      };
      return { proximoEstado: mapaEstado[fluxo], salvar: { fluxo, area: fluxo } };
    }

    // ── INICIO ADVOGADO (quero falar com advogado) ──
    case 'inicio_advogado': {
      if (mensagem === '1') return { proximoEstado: 'cliente_nome', salvar: { fluxo: 'cliente', area: 'cliente' } };
      return { proximoEstado: 'trabalhista_situacao', salvar: { fluxo: 'trabalhista', area: 'trabalhista' } };
    }

    // ── INICIO DETALHE (fallback progressivo) ──
    case 'inicio_detalhe': {
      let fluxo = null;
      if (mensagem === '1') fluxo = 'trabalhista';
      else if (mensagem === '2') fluxo = 'familia';
      else if (mensagem === '3') fluxo = 'cliente';
      else if (mensagem === '4') fluxo = 'outros';
      else fluxo = classificarPorTexto(mensagem);

      if (fluxo === 'advogado') return { proximoEstado: 'inicio_advogado', salvar: {} };
      if (!fluxo) return { proximoEstado: 'inicio_menu', salvar: {} };

      const mapaEstado = {
        cliente: 'cliente_nome',
        trabalhista: 'trabalhista_situacao',
        familia: 'familia_situacao',
        outros: 'outro_tipo',
      };
      return { proximoEstado: mapaEstado[fluxo], salvar: { fluxo, area: fluxo } };
    }

    // ── INICIO MENU (último recurso) ──
    case 'inicio_menu': {
      let fluxo = null;
      if (mensagem === '1') fluxo = 'trabalhista';
      else if (mensagem === '2') fluxo = 'familia';
      else if (mensagem === '3') fluxo = 'cliente';
      else if (mensagem === '4') fluxo = 'outros';
      else fluxo = classificarPorTexto(mensagem);

      if (fluxo === 'advogado') return { proximoEstado: 'inicio_advogado', salvar: {} };
      if (!fluxo) return { proximoEstado: 'outro_tipo', salvar: { fluxo: 'outros', area: 'outros' } };

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
      return { proximoEstado: 'cliente_canal_contato', salvar: { nome: mensagem } };

    case 'cliente_canal_contato':
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
      const proximo = scoreData.prioridade === 'QUENTE' ? 'quente_humano' : 'trabalhista_nome';
      return { proximoEstado: proximo, salvar: { intencao, ...scoreData } };
    }

    case 'trabalhista_nome':
      return { proximoEstado: 'trabalhista_canal_contato', salvar: { nome: mensagem } };

    case 'trabalhista_canal_contato':
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
      const proximo = scoreData.prioridade === 'QUENTE' ? 'quente_humano' : 'familia_nome';
      return { proximoEstado: proximo, salvar: { intencao, ...scoreData } };
    }

    // ── QUENTE — oferta de humano ──
    case 'quente_humano': {
      const sess = await storage.getSession(sessao);
      if (mensagem === '1') {
        // Quer falar com humano: finaliza e persiste imediatamente
        return { proximoEstado: `${sess.fluxo}_finalizado`, salvar: { querHumano: true } };
      }
      // Continua fluxo normal
      const mapaRetorno = { trabalhista: 'trabalhista_nome', familia: 'familia_nome', outros: 'outro_nome' };
      return { proximoEstado: mapaRetorno[sess.fluxo] || 'trabalhista_nome', salvar: {} };
    }

    case 'familia_nome':
      return { proximoEstado: 'familia_canal_contato', salvar: { nome: mensagem } };

    case 'familia_canal_contato':
      return { proximoEstado: 'familia_descricao', salvar: { canalPreferido: mensagem } };

    case 'familia_descricao':
      return { proximoEstado: 'familia_finalizado', salvar: { ultimaMensagem: mensagem } };

    // ── OUTROS ──
    case 'outro_tipo':
      return { proximoEstado: 'outro_impacto', salvar: { situacao: mensagem } };

    case 'outro_impacto': {
      const impacto = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, impacto });
      return { proximoEstado: 'outro_intencao', salvar: { impacto, ...scoreData } };
    }

    case 'outro_intencao': {
      const intencao = Math.min(3, Math.max(1, parseInt(mensagem) || 1));
      const sess = await storage.getSession(sessao);
      const scoreData = await recalcularScore(sessao, { ...sess, intencao });
      return { proximoEstado: 'outro_nome', salvar: { intencao, ...scoreData } };
    }

    case 'outro_nome':
      return { proximoEstado: 'outro_canal_contato', salvar: { nome: mensagem } };

    case 'outro_canal_contato':
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

  // 4. Primeira mensagem sem conteúdo: mostrar abertura
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
    const sessaoFinal = await storage.getSession(sessao);
    const msg = mensagemFinalizacao(sessaoFinal.prioridade);
    await sessionManager.updateSession(sessao, { ultimaPergunta: msg });
    return buildResposta(sessaoFinal, msg);
  }

  // 9. Próxima pergunta
  // Quando a transição é de 'inicio' para 'inicio_detalhe', retornar a abertura com a pergunta embutida
  let pergunta;
  if (sessaoObj.estadoAtual === 'inicio' && proximoEstado === 'inicio_detalhe') {
    pergunta = PERGUNTAS.inicio;
  } else {
    pergunta = PERGUNTAS[proximoEstado] || PERGUNTAS.inicio;
  }
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
