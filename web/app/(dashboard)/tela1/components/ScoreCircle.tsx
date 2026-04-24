'use client'

interface Props {
  score: number
}

export default function ScoreCircle({ score }: Props) {
  const isHot = score >= 7
  const isWarm = score >= 4
  const colorClass = isHot
    ? 'bg-score-hot/10 text-score-hot border-score-hot'
    : isWarm
    ? 'bg-score-warm/10 text-score-warm border-score-warm'
    : 'bg-score-cold/10 text-score-cold border-score-cold'

  const label = isHot ? 'QUENTE' : isWarm ? 'MORNO' : 'FRIO'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${colorClass}`}>
        <span className="font-mono text-lg font-bold">{score}</span>
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
