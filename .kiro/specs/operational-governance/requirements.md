# Requisitos — Governança Operacional BRO Resolve

## Contexto

Sistema identity-centric. 1 identity_id = 1 atendimento (singleton). Reentrada incrementa ciclo, não cria novo registro. lead_id é transporte. Toda query usa identity_id. PainelLead reflete estado, não cria.

## Glossário

- **Estado_Painel**: `lead` (triagem), `em_atendimento` (backoffice), `cliente` (pós-fechamento), `encerrado` (perda/arquivo)
- **Score**: 0-10 da URA (bot). Quente ≥7, Morno ≥4, Frio <4. Apenas visual. NÃO ordena fila.
- **Prioridade**: Apenas indicador visual. NÃO governa ordenação. Nunca persistida.
- **Ciclo**: Contador no atendimento. Incrementa a cada reentrada.
- **Motivo_Fechamento**: Enum fechado com valores definidos.
- **Sistema_Sweep**: Processo em server.js (5min) que aplica regras automáticas de abandono.

## Telas

- **Relacionamento (tela1)**: mostra APENAS `estado_painel IS NULL OR estado_painel = 'lead'`
- **Backoffice (tela2)**: mostra APENAS `estado_painel IN ('em_atendimento', 'cliente')`
- **Encerrados**: não aparecem em nenhuma tela ativa (arquivo)

## Restrições Globais (INVIOLÁVEL)

1. Nunca usar lead_id como fonte de verdade para atendimentos
2. Nunca criar novo atendimento (sempre update singleton)
3. Nunca persistir prioridade no banco
4. Nunca bloquear ação por owner
5. Nunca misturar estados entre telas
6. Nunca pular triagem na reentrada
7. Nunca ordenar por prioridade ou score
8. Sidebar máximo 100 itens

## Requisitos

### Requisito 1: Abandono Automático (7 dias)

**Condição COMPLETA:**
- estado_painel = 'em_atendimento'
- última mensagem foi do operador (ultima_msg_de = operador)
- cliente NÃO respondeu
- tempo ≥ 7 dias desde última mensagem

**Ação:** estado_painel = 'encerrado', motivo_fechamento = 'abandono_operador'

#### Critérios de Aceitação

1. WHEN estado_painel = 'em_atendimento' E última mensagem foi do operador E cliente não respondeu E tempo ≥ 7 dias, THEN Sistema_Sweep SHALL atualizar estado_painel para 'encerrado' e motivo_fechamento para 'abandono_operador'.
2. WHEN abandono ocorrer, THEN SHALL emitir socket `estado_painel_changed` com identity_id.
3. THE tempo limite SHALL ser configurável via `sla_config` (chave `tempo_abandono_atendimento_dias`, padrão 7).
4. THE abandono SHALL ser independente de owner.
5. THE condição SHALL verificar que ultima_msg_de = operador (não encerrar se última msg foi do cliente).

### Requisito 2: Abandono de Triagem (URA)

**Condição:** estado_painel = lead/null, sem interação do operador, tempo > 2h

**Ação:** estado_painel = 'encerrado', motivo_fechamento = 'abandono_ura'

#### Critérios de Aceitação

1. WHEN Lead com estado_painel 'lead' ou null permanece mais de 2 horas sem interação de Operador, THEN Sistema_Sweep SHALL atualizar estado_painel para 'encerrado' e motivo_fechamento para 'abandono_ura'.
2. WHEN abandono ocorrer, THEN SHALL emitir socket `estado_painel_changed` com identity_id.
3. THE tempo limite SHALL ser configurável via `sla_config` (chave `tempo_abandono_triagem_horas`, padrão 2).

### Requisito 3: Motivos de Encerramento (Enum Fechado)

**Valores:** abandono_ura, abandono_operador, bad_call, sem_perfil, nao_evoluiu, resolvido, preco, ja_fechou_outro, sem_retorno

#### Critérios de Aceitação

1. THE Atendimento SHALL aceitar exclusivamente estes valores para motivo_fechamento.
2. WHEN Sistema_Sweep encerrar automaticamente, THEN SHALL usar 'abandono_ura' ou 'abandono_operador'.
3. WHEN Operador encerrar manualmente, THEN SHALL selecionar um dos motivos manuais.

### Requisito 4: Ordenação da Sidebar (Estilo WhatsApp)

**Regra:** nova atividade = topo. Sem prioridade. Sem score na ordenação.

#### Critérios de Aceitação

1. THE Sidebar SHALL ordenar por `ultima_interacao DESC, created_at DESC` (nova mensagem ou nova entrada = topo).
2. THE Sidebar SHALL NÃO usar score, prioridade ou qualquer outro campo na ordenação.
3. WHEN nova mensagem chegar via socket, THEN lead sobe para o topo da lista.
4. WHEN novo lead entrar, THEN aparece no topo da lista.
5. THE ordenação SHALL ser idêntica ao comportamento do WhatsApp (mais recente primeiro).

### Requisito 5: Filtros da Sidebar (Relacionamento)

**Filtros:** Todos | Aguardando | Sem resposta

#### Critérios de Aceitação

1. THE Sidebar SHALL exibir filtro "Todos": todos os leads com estado_painel IS NULL ou 'lead'.
2. THE Sidebar SHALL exibir filtro "Aguardando": última mensagem = operador E tempo < 2h.
3. THE Sidebar SHALL exibir filtro "Sem resposta": última mensagem = operador E tempo ≥ 2h E tempo < 7 dias.
4. THE filtro padrão SHALL ser "Todos".
5. THE Sidebar SHALL exibir contagem em cada filtro.
6. THE Sidebar SHALL limitar 100 itens.

### Requisito 6: Reentrada de Cliente

**Trigger:** cliente com estado_painel = 'cliente' envia nova mensagem

**Ação:** ciclo += 1, estado_painel = 'lead', status_negocio = null, destino = null

**REGRA CRÍTICA:** NÃO muda de tela. Continua no backoffice. NÃO entra na sidebar da tela1.

#### Critérios de Aceitação

1. WHEN cliente envia mensagem E estado_painel = 'cliente', THEN: ciclo += 1, estado_painel = 'lead', status_negocio = null, destino = null.
2. WHEN reentrada de cliente ocorrer, THEN lead NÃO SHALL aparecer na sidebar da tela1 (continua no backoffice).
3. WHEN reentrada de cliente ocorrer, THEN SHALL emitir socket `estado_painel_changed`.
4. THE histórico SHALL permanecer intacto.

### Requisito 7: Reentrada de Encerrado

**Trigger:** lead com estado_painel = 'encerrado' envia nova mensagem

**Ação:** ciclo += 1, estado_painel = 'lead', status_negocio = null, destino = null

**REGRA:** Volta para RELACIONAMENTO (tela1).

#### Critérios de Aceitação

1. WHEN cliente envia mensagem E estado_painel = 'encerrado', THEN: ciclo += 1, estado_painel = 'lead', status_negocio = null, destino = null.
2. WHEN reentrada de encerrado ocorrer, THEN lead SHALL aparecer na sidebar da tela1 (volta para relacionamento).
3. WHEN reentrada ocorrer, THEN SHALL emitir socket `estado_painel_changed` e `lead_reaquecido`.
4. WHEN reentrada ocorrer, THEN bot reinicia do zero.
5. THE histórico SHALL permanecer intacto.

### Requisito 8: Queries por Tela (HARD)

#### Critérios de Aceitação

1. THE tela1 (relacionamento) SHALL usar query: `WHERE estado_painel IS NULL OR estado_painel = 'lead'`. Sem exceção.
2. THE tela2 (backoffice) SHALL usar query: `WHERE estado_painel IN ('em_atendimento', 'cliente')`. Sem exceção.
3. THE encerrados SHALL NÃO aparecer em nenhuma tela ativa.

### Requisito 9: Socket em Todas as Transições

#### Critérios de Aceitação

1. WHEN estado_painel mudar por qualquer motivo, THEN backend SHALL emitir `estado_painel_changed` com `{ identity_id, lead_id, estado_painel }`.
2. WHEN frontend emitir `estado_painel_changed`, THEN backend SHALL reemitir via `io.emit()`.
3. THE reentrada de cliente SHALL emitir socket (para que backoffice atualize).
4. THE reentrada de encerrado SHALL emitir socket (para que tela1 mostre o lead).

## Definição de Done

- [ ] Abandono 7 dias funciona (condição completa: última msg = operador + cliente silencioso)
- [ ] Abandono URA 2h funciona
- [ ] Sidebar ordena estilo WhatsApp (ultima_interacao DESC)
- [ ] Score/prioridade NÃO aparecem na ordenação
- [ ] Filtros: Todos / Aguardando / Sem resposta funcionam
- [ ] Reentrada de cliente: ciclo+1, continua no backoffice, NÃO vai pra tela1
- [ ] Reentrada de encerrado: ciclo+1, volta pra tela1
- [ ] tela1 mostra APENAS lead/null
- [ ] tela2 mostra APENAS em_atendimento/cliente
- [ ] Socket emitido em TODAS as transições
