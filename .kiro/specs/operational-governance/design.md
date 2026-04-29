# Design — Governança Operacional

## Visão Geral

Ajustes cirúrgicos em 4 áreas: (1) função `computePriority` no frontend, (2) refatoração da sidebar com abas Ativos/Encerrados, (3) correção das condições de abandono no sweep, (4) tag visual de motivo nos encerrados. Nenhuma tabela nova. Nenhuma API nova. Tudo usa estruturas existentes.

## Arquitetura

```
┌─────────────┐   socket: estado_painel_changed   ┌──────────────────┐
│  server.js   │ ──────────────────────────────────▶│  ConversasSidebar │
│  sweepOp()   │                                    │  (abas + sort)    │
└──────┬───────┘                                    └────────┬─────────┘
       │ UPDATE atendimentos                                 │
       │ SET estado_painel, motivo_fechamento                │ computePriority()
       ▼                                                     ▼
┌──────────────┐                                    ┌──────────────────┐
│  Supabase     │◀──── query por aba ───────────────│  usePainelContext │
│  atendimentos │                                    └──────────────────┘
└──────────────┘
```

Fluxo: sweep detecta abandono → atualiza atendimento via `identity_id` → emite socket → sidebar refetch → reordena com `computePriority`.

## Componentes e Interfaces

### 1. `computePriority(lead)` — `web/utils/computePriority.ts`

Função pura. Sem estado, sem side-effects. Retorna `'ALTA' | 'MEDIA' | 'BAIXA'`.

```typescript
interface PriorityInput {
  prazo_proxima_acao: string | null  // ISO date
  created_at: string                  // ISO date
  ciclo: number                       // >= 1
  score: number                       // 0-10
  ultima_msg_de: string | null        // 'operador' | 'lead' | 'bot' | null
}

type Prioridade = 'ALTA' | 'MEDIA' | 'BAIXA'

function computePriority(lead: PriorityInput): Prioridade
```

Lógica (if/else, sem abstração):
- **ALTA** se qualquer: `prazo_proxima_acao` vencido, OU criado < 30min, OU `ciclo > 1`, OU `score >= 7`
- **MEDIA** se nenhuma ALTA e qualquer: `score >= 4`, OU `ultima_msg_de === 'operador'`
- **BAIXA** caso contrário

### 2. ConversasSidebar — Refatoração

Mudanças na sidebar existente (`web/app/(dashboard)/tela1/components/ConversasSidebar.tsx`):

- Substituir pills (Todos/Aguardando/Sem retorno) por 2 abas: **Ativos** | **Encerrados**
- Aba Ativos: query `estado_painel IN (null, 'lead', 'em_atendimento', 'cliente')`
- Aba Encerrados: query `estado_painel = 'encerrado'`
- Contagem em cada aba
- Limite 100 itens por aba
- Ordenação na aba Ativos: (1) não lidas primeiro, (2) ALTA → MEDIA → BAIXA, (3) maior tempo sem interação
- Aba Encerrados: ordenação por `encerrado_em DESC`

### 3. Sweep — Correção de Condições (`server.js`)

**abandono_ura** (atual: `status_operacao = 'novo'` → corrigir para):
```sql
-- Condição correta:
estado_painel IN ('lead', NULL)
AND sem interação de operador (nenhuma msg com de='operador' para esse identity_id)
AND created_at < (now - tempo_abandono_triagem_horas)
```
Ação: `estado_painel = 'encerrado'`, `motivo_fechamento = 'abandono_ura'`

**abandono_operador** (atual: qualquer lead inativo → corrigir para):
```sql
-- Condição correta:
estado_painel = 'em_atendimento'
AND ultima_msg_de = 'operador' (última msg foi do operador)
AND ultima_msg_em < (now - tempo_abandono_atendimento_horas)
```
Ação: `estado_painel = 'encerrado'`, `motivo_fechamento = 'abandono_operador'`

Ambos usam `identity_id` para UPDATE no atendimento (nunca `lead_id`).

### 4. MotivoTag — Componente Visual

Badge simples em `web/app/(dashboard)/tela1/components/MotivoTag.tsx`:

```typescript
interface MotivoTagProps {
  motivo: string | null
}
```

Mapa de cores por motivo (ex: `abandono_ura` → cinza, `resolvido` → verde, `sem_perfil` → amarelo). Renderiza `<span>` com texto humanizado.

### 5. Socket — `estado_painel_changed`

Já implementado. Payload: `{ identity_id, lead_id, estado_painel }`. Backend emite via `io.emit()`. Frontend escuta via `usePainelContext` e faz refetch. Sidebar escuta para mover lead entre abas.

## Modelos de Dados

Nenhuma tabela nova. Colunas já existentes em `atendimentos`:

| Coluna | Tipo | Uso |
|--------|------|-----|
| `estado_painel` | TEXT | Roteamento: lead/em_atendimento/cliente/encerrado |
| `motivo_fechamento` | TEXT | Enum: 9 valores (abandono_ura, abandono_operador, bad_call, sem_perfil, nao_evoluiu, resolvido, preco, ja_fechou_outro, sem_retorno) |
| `identity_id` | UUID | FK → identities. Chave de lookup singleton |
| `ciclo` | INT | Contador de reentradas |
| `encerrado_em` | TIMESTAMPTZ | Timestamp do encerramento |

Query da aba Ativos (via Supabase client):
```sql
SELECT * FROM atendimentos a
JOIN leads l ON l.identity_id = a.identity_id
WHERE a.estado_painel IN ('lead', 'em_atendimento', 'cliente')
   OR a.estado_painel IS NULL
ORDER BY l.ultima_msg_em ASC
LIMIT 100
```

Query da aba Encerrados:
```sql
SELECT * FROM atendimentos a
JOIN leads l ON l.identity_id = a.identity_id
WHERE a.estado_painel = 'encerrado'
ORDER BY a.encerrado_em DESC
LIMIT 100
```


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Classificação exaustiva de prioridade

*Para qualquer* `PriorityInput` válido, `computePriority` SHALL retornar exatamente um de `'ALTA' | 'MEDIA' | 'BAIXA'`, onde:
- Se prazo vencido OU criado < 30min OU ciclo > 1 OU score ≥ 7 → `'ALTA'`
- Senão, se score ≥ 4 OU ultima_msg_de = 'operador' → `'MEDIA'`
- Senão → `'BAIXA'`

As três categorias são mutuamente exclusivas e exaustivas.

**Valida: Requisitos 4.1, 4.2, 4.3, 4.4**

### Propriedade 2: Invariante de ordenação da sidebar

*Para qualquer* lista de leads com prioridades e status de leitura, a ordenação SHALL satisfazer: (1) leads não lidos antes de lidos, (2) dentro do mesmo grupo de leitura: ALTA antes de MEDIA antes de BAIXA, (3) dentro da mesma prioridade: maior tempo sem interação primeiro.

**Valida: Requisitos 4.5**

### Propriedade 3: Partição de abas por estado_painel

*Para qualquer* lead com `estado_painel` definido, o lead SHALL aparecer na aba Ativos se `estado_painel IN (null, 'lead', 'em_atendimento', 'cliente')` e na aba Encerrados se `estado_painel = 'encerrado'`. Nenhum lead aparece em ambas as abas.

**Valida: Requisitos 5.2, 5.3**

### Propriedade 4: Validação do enum motivo_fechamento

*Para qualquer* string, ela SHALL ser aceita como motivo_fechamento se e somente se pertencer ao conjunto `{abandono_ura, abandono_operador, bad_call, sem_perfil, nao_evoluiu, resolvido, preco, ja_fechou_outro, sem_retorno}`.

**Valida: Requisitos 3.1**

### Propriedade 5: Limite de 100 itens por aba

*Para qualquer* lista de leads maior que 100, a lista exibida na aba SHALL conter no máximo 100 itens.

**Valida: Requisitos 5.7**

## Tratamento de Erros

| Cenário | Tratamento |
|---------|------------|
| `sla_config` indisponível | Usar defaults (2h triagem, 24h atendimento) |
| `identity_id` null no sweep | Skip lead, log warning |
| Socket desconectado | Frontend faz polling na próxima interação do usuário |
| Query retorna > 100 itens | Truncar no frontend com `.slice(0, 100)` |
| `motivo_fechamento` inválido | Rejeitar no frontend (validação antes do save) |

## Estratégia de Testes

### Testes de Propriedade (PBT)

Biblioteca: **fast-check** (já disponível no ecossistema Next.js/TypeScript)

Cada propriedade acima será implementada como um teste com mínimo 100 iterações:

1. **computePriority** — gerar `PriorityInput` aleatórios, verificar classificação correta (Propriedades 1)
2. **sortLeads** — gerar listas aleatórias de leads, verificar invariante de ordenação (Propriedade 2)
3. **filterByTab** — gerar leads com `estado_painel` aleatório, verificar partição correta (Propriedade 3)
4. **isValidMotivo** — gerar strings aleatórias, verificar aceitação/rejeição (Propriedade 4)
5. **limitList** — gerar listas de tamanho aleatório, verificar truncamento (Propriedade 5)

Tag format: `Feature: operational-governance, Property {N}: {texto}`

### Testes Unitários (Exemplos)

- Aba padrão é Ativos
- MotivoTag renderiza corretamente para cada motivo
- Sweep usa apenas `abandono_ura` e `abandono_operador` como motivos automáticos

### Testes de Integração

- Sweep abandono_ura: lead em triagem > 2h → encerrado
- Sweep abandono_operador: lead em atendimento, última msg do operador, > 24h → encerrado
- Reentrada: mensagem do cliente com estado encerrado → ciclo incrementa, volta para lead
- Socket broadcast: estado_painel_changed emitido e recebido por múltiplos clientes
