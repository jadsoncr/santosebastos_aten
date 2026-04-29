/**
 * slaConfig.ts — Configuração central de thresholds e flags.
 *
 * Fonte única de verdade para todos os valores de SLA, tempos de alerta,
 * e flags de comportamento. Nenhum componente deve hardcodar esses valores.
 *
 * Valores default podem ser sobrescritos via configuracoes_sla do banco
 * (futuro: hook useSlaConfig que carrega do Supabase).
 */

// ── Thresholds de tempo (em minutos) ──

export interface SlaThresholds {
  /** Tempo em minutos para resposta ser considerada crítica (default: 30) */
  resposta_critica_min: number
  /** Tempo em minutos para resposta ser considerada alerta (default: 15) */
  resposta_alerta_min: number
  /** Tempo em horas para triagem ser considerada crítica (default: 2) */
  triagem_critica_horas: number
  /** Tempo em minutos para auto-release ao bot (default: 5) */
  auto_release_min: number
  /** Tempo em minutos para snooze (default: 60) */
  snooze_min: number
  /** Tempo em horas para abandono de triagem (default: 2) */
  abandono_triagem_horas: number
  /** Tempo em dias para abandono de atendimento (default: 7) */
  abandono_atendimento_dias: number
}

// ── Flags de comportamento ──

export interface SlaFlags {
  /** Habilitar som de alerta para leads críticos */
  sound_enabled: boolean
  /** Habilitar destaque visual (banner, separador) para leads críticos */
  highlight_enabled: boolean
  /** Habilitar tracking de comportamento do operador */
  tracking_enabled: boolean
}

// ── Configuração completa ──

export interface SlaConfig extends SlaThresholds, SlaFlags {}

// ── Valores default ──

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  // Thresholds
  resposta_critica_min: 30,
  resposta_alerta_min: 15,
  triagem_critica_horas: 2,
  auto_release_min: 5,
  snooze_min: 60,
  abandono_triagem_horas: 2,
  abandono_atendimento_dias: 7,
  // Flags
  sound_enabled: true,
  highlight_enabled: true,
  tracking_enabled: true,
}

// ── Singleton config (pode ser atualizado em runtime via hook futuro) ──

let _config: SlaConfig = { ...DEFAULT_SLA_CONFIG }

/**
 * Retorna a configuração SLA atual.
 * Pura leitura — sem side effects.
 */
export function getSlaConfig(): SlaConfig {
  return _config
}

/**
 * Atualiza a configuração SLA em runtime.
 * Usado pelo hook useSlaConfig quando carrega do banco.
 */
export function updateSlaConfig(partial: Partial<SlaConfig>): void {
  _config = { ..._config, ...partial }
}

/**
 * Reseta para valores default (útil para testes).
 */
export function resetSlaConfig(): void {
  _config = { ...DEFAULT_SLA_CONFIG }
}

// ── Constantes derivadas (em milissegundos) para uso em cálculos ──

export function getThresholdsMs(config?: SlaConfig): {
  resposta_critica_ms: number
  resposta_alerta_ms: number
  triagem_critica_ms: number
} {
  const c = config ?? _config
  return {
    resposta_critica_ms: c.resposta_critica_min * 60 * 1000,
    resposta_alerta_ms: c.resposta_alerta_min * 60 * 1000,
    triagem_critica_ms: c.triagem_critica_horas * 60 * 60 * 1000,
  }
}
