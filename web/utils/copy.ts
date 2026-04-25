/**
 * copy.ts — Mapeamento centralizado de terminologia do BRO Resolve v1.1
 *
 * Todas as strings da interface passam por este mapeamento.
 * Facilita manutenção, i18n futuro e consistência visual.
 *
 * Regra: ZERO emojis. Linguagem profissional B2B/jurídica.
 */

export const COPY = {
  // ── Sidebar principal ──────────────────────────────────────
  sidebar: {
    titulo: 'BRO Resolve',
    captacao: 'Captação',
    carteira: 'Carteira',
    financeiro: 'Gestão Financeira',
    backoffice: 'Configurações',
  },

  // ── ConversasSidebar — seções ──────────────────────────────
  conversas: {
    operacaoAtiva: 'Operação Ativa',
    captacao: 'Captação',
    emAtendimento: 'Em Atendimento',
    aguardandoRetorno: 'Aguardando Retorno',
    nenhumCaptacao: 'Nenhum prospecto na captação',
    nenhumAtendimento: 'Nenhum em atendimento',
    nenhumAguardando: 'Nenhum aguardando retorno',
  },

  // ── CardBotTree — badges ───────────────────────────────────
  badges: {
    prospecto: 'PROSPECTO',
    carteiraAtiva: 'CARTEIRA ATIVA',
    reativado: 'REATIVADO',
  },

  // ── ChatCentral — header e controles ───────────────────────
  chat: {
    atendimentoHumano: 'Atendimento Humano',
    automacaoAtiva: 'Automação Ativa',
    notaInterna: 'Nota interna',
    mensagem: 'Mensagem',
    selecioneConversa: 'Selecione uma conversa',
    delegar: 'DELEGAR',
    aguardando: 'AGUARDANDO',
    encerrar: 'ENCERRAR',
  },

  // ── BlocoQualificacao ──────────────────────────────────────
  qualificacao: {
    dossieEstrategico: 'Dossiê Estratégico',
    salvarNota: 'Salvar nota',
    editarTelefone: 'Editar telefone',
    vincularIdentidade: 'Vincular a Identidade Existente',
    contatoWhatsApp: 'Contato via WhatsApp',
    telefoneIndisponivel: 'Telefone não disponível',
    converter: 'CONVERTER',
    naoFechou: 'NÃO FECHOU',
    encerrarEnfileirar: 'ENCERRAR E ENFILEIRAR',
    acompanhamento: 'IR PARA ACOMPANHAMENTO',
    arquivar: 'Arquivar interação',
    assumaPrimeiro: 'Assuma o lead primeiro',
    valorEstimado: 'Valor estimado (R$)',
    valorEntrada: 'Valor de entrada (R$)',
    metodoPagamento: 'Método de pagamento',
    valorHonorarios: 'Honorários finais (R$)',
    dataBaixa: 'Data de baixa',
    segmento: 'Segmento',
    assunto: 'Assunto',
    especificacao: 'Especificação',
    nenhumaOpcao: 'Nenhuma opção disponível',
  },

  // ── ScoreCircle — labels de propensão ──────────────────────
  score: {
    alta: 'Alta Propensão',
    media: 'Média Propensão',
    baixa: 'Baixa Propensão',
  },

  // ── Indicadores (substituem emojis na sidebar) ─────────────
  indicadores: {
    reativado: 'R',
    cliente: 'C',
    alerta: '!',
    sla: 'SLA',
  },

  // ── Pipeline stages ────────────────────────────────────────
  pipeline: {
    ENTRADA: 'Captação',
    QUALIFICADO: 'Qualificação',
    EM_ATENDIMENTO: 'Em Atendimento',
    AGENDAMENTO: 'Agendamento',
    DEVOLUTIVA: 'Devolutiva',
    PAGAMENTO_PENDENTE: 'Pagamento Pendente',
    CARTEIRA_ATIVA: 'Carteira Ativa',
    FINALIZADO: 'Finalizado',
  },

  // ── Ações rápidas (timeline) ───────────────────────────────
  acoes: {
    agendarReuniao: 'Agendar Reunião',
    enviarProposta: 'Enviar Proposta',
    pedirDocumentos: 'Solicitar Documentos',
    avancarPipeline: 'Avançar Pipeline',
  },
} as const
