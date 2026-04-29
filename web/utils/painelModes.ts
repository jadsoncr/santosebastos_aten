/**
 * painelModes.ts — Mapa de modos do PainelLead
 *
 * Cada estado_painel mapeia para uma config de blocos visíveis.
 * O hook usePainelMode() é a única fonte de verdade para renderização condicional.
 */

import { useMemo } from 'react'

// --- Tipos ---

export type EstadoPainel = 'triagem' | 'em_atendimento' | 'cliente' | 'encerrado'

export interface PainelModeConfig {
  header: boolean
  identidade: boolean
  intencao: boolean
  classJuridica: boolean
  dossie: boolean
  tratamento: boolean
  resultado: boolean
  botaoConfirmacao: boolean
  statusAtual: boolean
  botoesAcao: boolean
  contrato: boolean
  motivoEncerramento: boolean
  botaoReengajar: boolean
  botaoNovoAtendimento: boolean
}

// --- Mapa de modos ---

const OFF: PainelModeConfig = {
  header: false,
  identidade: false,
  intencao: false,
  classJuridica: false,
  dossie: false,
  tratamento: false,
  resultado: false,
  botaoConfirmacao: false,
  statusAtual: false,
  botoesAcao: false,
  contrato: false,
  motivoEncerramento: false,
  botaoReengajar: false,
  botaoNovoAtendimento: false,
}

export const PAINEL_MODES: Record<EstadoPainel, PainelModeConfig> = {
  triagem: {
    ...OFF,
    header: true,
    identidade: true,
    intencao: true,
    classJuridica: true,
    dossie: true,
    tratamento: true,
    resultado: true,
    botaoConfirmacao: true,
  },
  em_atendimento: {
    ...OFF,
    header: true,
    identidade: true,
    dossie: true,
    statusAtual: true,
    botoesAcao: true,
  },
  cliente: {
    ...OFF,
    header: true,
    identidade: true,
    dossie: true,
    contrato: true,
    botaoNovoAtendimento: true,
  },
  encerrado: {
    ...OFF,
    header: true,
    identidade: true,
    dossie: true,
    motivoEncerramento: true,
    botaoReengajar: true,
  },
}

// --- Hook ---

export function usePainelMode(estadoPainel: EstadoPainel | null): PainelModeConfig {
  return useMemo(
    () => PAINEL_MODES[estadoPainel ?? 'triagem'],
    [estadoPainel],
  )
}
