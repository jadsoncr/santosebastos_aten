// ══════════════════════════════════════════════════════════════
// Continuous Flow UX — Tipos Compartilhados
// web/core/flow/types.ts
// ══════════════════════════════════════════════════════════════

// ── Estados e Ações ──

export type EstadoPainel = 'triagem' | 'em_atendimento' | 'cliente' | 'encerrado'

export type FlowAction =
  | 'classificar'
  | 'avancar_etapa'
  | 'fechar'
  | 'perder'
  | 'reativar'
  | 'delegar'
  | 'novo_atendimento'

export type FlowEffectType =
  | 'apply_transaction'
  | 'derive_status'
  | 'emit_socket'
  | 'refetch'
  | 'auto_select'
  | 'toast_destino'
  | 'suggest_template'
  | 'celebrate'

export type ToastVariant = 'success' | 'info' | 'celebration'

export type TransitionStatus = 'stable' | 'transitioning' | 'failed' | 'ambiguous'

export type Confidence = 'high' | 'medium' | 'low'

export type ActionType = 'auto' | 'assisted' | 'blocked'

// ── Contexto ──

export interface FlowContext {
  atendimentoId: string
  identityId: string
  leadId: string
  currentState: EstadoPainel
  currentStage: string | null
  operadorId: string
  snapshotVersion: number
  metadata?: Record<string, unknown>
}

// ── Transição ──

export interface Transition {
  toState: EstadoPainel
  effects: FlowEffectType[]
  toastMessage: string
  toastAction?: string
  toastVariant: ToastVariant
}

export interface FlowTransitionResult {
  transitionId: string
  idempotencyKey: string
  snapshotVersion: number
  action: FlowAction
  fromState: EstadoPainel
  toState: EstadoPainel
  effects: FlowEffectType[]
  status: TransitionStatus
  error?: string
  startedAt: number
  completedAt?: number
  durationMs?: number
}

// ── Next Action ──

export interface NextActionContext {
  action: FlowAction | 'follow_up' | 'registrar_financeiro' | 'acompanhar' | 'revisar'
  label: string
  destination: EstadoPainel | string
  description: string
  confidence: Confidence
  type: ActionType
  reason?: string
  unblockAction?: string
}

// ── Serviços Injetados ──

export interface ApplyTransactionParams {
  ctx: Readonly<FlowContext>
  toState: EstadoPainel
  action: FlowAction
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface ApplyTransactionResult {
  status: 'applied' | 'already_applied'
  newVersion: number
}

export interface FlowServices {
  applyTransaction: (params: ApplyTransactionParams) => Promise<ApplyTransactionResult>
  deriveStatus: (ctx: Readonly<FlowContext>, toState: EstadoPainel) => Promise<void>
  emitSocket: (event: string, payload: Record<string, unknown>) => void
  showToast: (message: string, options: {
    actionLabel?: string
    onAction?: () => void
    variant: ToastVariant
    duration?: number
  }) => void
  autoSelect: (excludeLeadId: string) => void
  refetch: () => void
  suggestTemplate: (classificationType: string) => void
  celebrate: () => void
  trackBehavior: (params: {
    leadId: string
    userId: string
    eventType: string
    metadata?: Record<string, unknown>
  }) => void
}

// ── Toast Props ──

export interface ActionToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  duration?: number
  variant: ToastVariant
  onDismiss?: () => void
}

// ── Idempotency Key ──

/**
 * Gera uma chave de idempotência determinística.
 * Mesma entrada → mesma saída (determinismo).
 * Versões diferentes → chaves diferentes.
 */
export function generateIdempotencyKey(
  action: string,
  atendimentoId: string,
  snapshotVersion: number
): string {
  const raw = `${action}:${atendimentoId}:${snapshotVersion}`
  // FNV-1a hash (32-bit) — rápido e com boa distribuição
  let hash = 2166136261
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Converter para string base36 positiva + prefixo
  const hashStr = (hash >>> 0).toString(36)
  return `flow_${hashStr}_v${snapshotVersion}`
}
