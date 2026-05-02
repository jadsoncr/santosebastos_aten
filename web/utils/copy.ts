/**
 * copy.ts — Mapeamento centralizado de terminologia do TORIS
 *
 * Todas as strings da interface passam por este mapeamento.
 * Facilita manutenção, i18n futuro e consistência visual.
 *
 * Regra: ZERO emojis. Linguagem profissional B2B/jurídica.
 */

export const COPY = {
  // ── Sidebar principal ──────────────────────────────────────
  sidebar: {
    titulo: 'TORIS',
    captacao: 'Entrada',
    carteira: 'Execução',
    financeiro: 'Receita',
    backoffice: 'Configurações',
  },

  // ── ConversasSidebar — seções ──────────────────────────────
  conversas: {
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
    selecioneConversa: 'Selecione uma entrada',
    delegar: 'DELEGAR',
    aguardando: 'AGUARDANDO',
    encerrar: 'ENCERRAR',
  },

  // ── BlocoQualificacao ──────────────────────────────────────
  qualificacao: {
    dossieEstrategico: 'Contexto acumulado',
    salvarNota: 'Salvar nota',
    editarTelefone: 'Editar telefone',
    vincularIdentidade: 'Vincular a Identidade Existente',
    contatoWhatsApp: 'Contato via WhatsApp',
    telefoneIndisponivel: 'Telefone não disponível',
    converter: 'EXECUTAR DECISÃO',
    naoFechou: 'ENCERRAR DECISÃO',
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

  // ── Indicadores (substituem emojis na sidebar) ─────────────
  indicadores: {
    reativado: 'R',
    cliente: 'C',
    alerta: '!',
    sla: 'SLA',
  },

  // ── Busca e filtros ────────────────────────────────────────
  busca: {
    placeholder: 'Buscar entrada...',
    nenhumResultado: 'Nenhum contato encontrado.',
    adicionarNovo: 'Deseja adicionar?',
    novoContato: 'Novo Contato',
  },

  pills: {
    tudo: 'Tudo',
    naoLidas: 'Não Lidas',
    retorno: 'Retorno',
  },
} as const
