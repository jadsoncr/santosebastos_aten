'use client'

import ScoreCircle from './ScoreCircle'
import { COPY } from '@/utils/copy'
import type { Lead } from '../page'

interface CardBotTreeProps {
  lead: Lead
  isCliente: boolean
}

export default function CardBotTree({ lead, isCliente }: CardBotTreeProps) {
  return (
    <div className="space-y-4">
      {/* Badge de identidade */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            isCliente
              ? 'bg-success/10 text-success'
              : 'bg-accent/10 text-accent'
          }`}
        >
          {isCliente ? COPY.badges.carteiraAtiva : COPY.badges.prospecto}
        </span>
        {(lead as any).is_reaquecido && (
          <span className="text-xs px-2 py-1 rounded-lg bg-score-hot/10 text-score-hot font-medium">
            {COPY.badges.reativado}
          </span>
        )}
      </div>

      {/* Score — só pra LEAD */}
      {!isCliente && (
        <div className="flex justify-center">
          <ScoreCircle score={lead.score} />
        </div>
      )}

      {/* Área bot */}
      <div>
        <span className="text-xs text-text-muted block mb-1">Area (bot)</span>
        <span className="inline-block px-2 py-1 rounded-full text-xs bg-bg-surface-hover text-text-secondary">
          {lead.area_bot || lead.area || '\u2014'}
        </span>
      </div>

      {/* Prioridade */}
      {!isCliente && (
        <div>
          <span className="text-xs text-text-muted block mb-1">Prioridade</span>
          <span className="text-sm text-text-primary">{lead.prioridade || '\u2014'}</span>
        </div>
      )}
    </div>
  )
}
