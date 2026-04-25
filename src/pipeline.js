/**
 * pipeline.js — Pipeline de 8 Estados do BRO Resolve v1.1
 *
 * Módulo CommonJS para uso direto em server.js.
 * Valida transições lineares com condições por estágio.
 */

const PIPELINE_STAGES = [
  'ENTRADA',
  'QUALIFICADO',
  'EM_ATENDIMENTO',
  'AGENDAMENTO',
  'DEVOLUTIVA',
  'PAGAMENTO_PENDENTE',
  'CARTEIRA_ATIVA',
  'FINALIZADO',
];

const STAGE_INDEX = {};
PIPELINE_STAGES.forEach((s, i) => { STAGE_INDEX[s] = i; });

/**
 * Valida se a transição de `from` para `to` é permitida
 * dado as condições atuais do lead/atendimento.
 *
 * @param {string} from - Estágio atual
 * @param {string} to - Estágio destino
 * @param {object} conditions - Dados do lead + condições adicionais
 * @returns {{ allowed: boolean, error?: string }}
 */
function validateTransition(from, to, conditions) {
  const fromIdx = STAGE_INDEX[from];
  const toIdx = STAGE_INDEX[to];

  if (fromIdx === undefined || toIdx === undefined) {
    return { allowed: false, error: 'Estágio inválido.' };
  }

  if (toIdx !== fromIdx + 1) {
    return { allowed: false, error: 'Transição inválida. Só é permitido avançar um estágio.' };
  }

  switch (to) {
    case 'QUALIFICADO':
      if (!conditions.nome?.trim()) return { allowed: false, error: 'Nome é obrigatório.' };
      if (!conditions.telefone?.trim()) return { allowed: false, error: 'Telefone é obrigatório.' };
      if ((conditions.score ?? 0) <= 7) return { allowed: false, error: 'Score deve ser maior que 7.' };
      break;

    case 'EM_ATENDIMENTO':
      // Validado pelo evento assumir_lead — sem condições adicionais
      break;

    case 'AGENDAMENTO':
      if (!conditions.agendamento_data) return { allowed: false, error: 'Data do agendamento é obrigatória.' };
      if (!conditions.agendamento_local?.trim()) return { allowed: false, error: 'Local é obrigatório.' };
      break;

    case 'DEVOLUTIVA':
      if (!conditions.documento_enviado) return { allowed: false, error: 'Documento deve ser enviado.' };
      break;

    case 'PAGAMENTO_PENDENTE':
      if (!conditions.documento_assinado) return { allowed: false, error: 'Documento assinado é obrigatório.' };
      break;

    case 'CARTEIRA_ATIVA':
      if (!conditions.valor_entrada || conditions.valor_entrada <= 0) return { allowed: false, error: 'Valor de entrada deve ser positivo.' };
      if (!conditions.metodo_pagamento?.trim()) return { allowed: false, error: 'Método de pagamento é obrigatório.' };
      break;

    case 'FINALIZADO':
      if (!conditions.valor_honorarios_finais || conditions.valor_honorarios_finais <= 0) return { allowed: false, error: 'Honorários finais devem ser positivos.' };
      if (!conditions.data_baixa) return { allowed: false, error: 'Data de baixa é obrigatória.' };
      break;
  }

  return { allowed: true };
}

module.exports = { PIPELINE_STAGES, STAGE_INDEX, validateTransition };
