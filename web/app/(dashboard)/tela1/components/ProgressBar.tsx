'use client'

const STAGES = [
  'ENTRADA', 'QUALIFICADO', 'EM_ATENDIMENTO', 'AGENDAMENTO',
  'DEVOLUTIVA', 'PAGAMENTO_PENDENTE', 'CARTEIRA_ATIVA', 'FINALIZADO'
] as const

const PIPELINE_LABELS: Record<string, string> = {
  ENTRADA: 'Captação',
  QUALIFICADO: 'Qualificação',
  EM_ATENDIMENTO: 'Em Atendimento',
  AGENDAMENTO: 'Agendamento',
  DEVOLUTIVA: 'Devolutiva',
  PAGAMENTO_PENDENTE: 'Pagamento Pendente',
  CARTEIRA_ATIVA: 'Carteira Ativa',
  FINALIZADO: 'Finalizado',
}

type PipelineStage = typeof STAGES[number]

interface ProgressBarProps {
  currentStage: PipelineStage | string | null | undefined
}

export default function ProgressBar({ currentStage }: ProgressBarProps) {
  const currentIdx = STAGES.indexOf((currentStage || 'ENTRADA') as PipelineStage)
  const safeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const isCompleted = i < safeIdx
          const isCurrent = i === safeIdx

          return (
            <div key={stage} className="flex-1 flex flex-col items-center">
              <div className={`h-1.5 w-full rounded-full transition-colors ${
                isCompleted ? 'bg-success' :
                isCurrent ? 'bg-accent animate-pulse' :
                'bg-border'
              }`} />
            </div>
          )
        })}
      </div>
      <p className="text-[10px] font-medium text-accent mt-1 text-center">
        {PIPELINE_LABELS[(currentStage || 'ENTRADA')] || currentStage || 'Captação'}
      </p>
    </div>
  )
}
