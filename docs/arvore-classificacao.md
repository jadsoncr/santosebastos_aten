# Árvore de Classificação Completa — BRO Resolve

## Legenda

| Coluna | Descrição |
|--------|-----------|
| Segmento | Nível 1 — área jurídica (URA) |
| Assunto | Nível 2 — categoria dentro do segmento |
| Especificação | Nível 3 — subcategoria (folha da árvore) |
| Status Negócio | Estado inicial no pipeline do backoffice |
| Destino | Para onde o lead vai após classificação |
| Fila | Se o lead sai ou fica na sidebar |
| Ação | Próximo passo do operador |

---

## TRABALHISTA (Dr. Rafael)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Assédio Moral | Humilhação | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Assédio Moral | Abuso de Poder | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Assédio Moral | Isolamento | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Assédio Sexual | Abordagem indevida | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Assédio Sexual | Coerção | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Rescisão | Sem justa causa | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Rescisão | Justa causa contestada | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Rescisão | Rescisão indireta | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Rescisão | Acordo trabalhista | aguardando_proposta | backoffice | sai | Enviar proposta |
| Horas Extras | Não pagamento | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Horas Extras | Banco de horas irregular | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Acidente de Trabalho | Afastamento INSS | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Acidente de Trabalho | Doença ocupacional | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Acidente de Trabalho | Estabilidade acidentária | aguardando_agendamento | backoffice | sai | Agendar reunião |

**Total: 14 especificações**

---

## FAMÍLIA (Dra. Mariana)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Divórcio | Consensual | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Divórcio | Litigioso | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Divórcio | Partilha de bens | aguardando_proposta | backoffice | sai | Enviar proposta |
| Guarda | Compartilhada | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Guarda | Unilateral | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Guarda | Regulamentação de visitas | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Pensão Alimentícia | Fixação | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Pensão Alimentícia | Revisão | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Pensão Alimentícia | Execução de alimentos | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Inventário | Judicial | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Inventário | Extrajudicial | aguardando_proposta | backoffice | sai | Enviar proposta |

**Total: 11 especificações**

---

## CONSUMIDOR (Dra. Beatriz)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Produto com defeito | Troca recusada | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Produto com defeito | Garantia negada | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Produto com defeito | Vício oculto | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Cobrança indevida | Cartão de crédito | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Cobrança indevida | Serviço não contratado | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Cobrança indevida | Taxa abusiva | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Propaganda enganosa | Oferta não cumprida | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Propaganda enganosa | Informação falsa | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Negativação indevida | SPC/Serasa indevido | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Negativação indevida | Dano moral | aguardando_proposta | backoffice | sai | Enviar proposta |

**Total: 10 especificações**

---

## CÍVEL (Dr. André)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Contratos | Descumprimento contratual | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Contratos | Rescisão contratual | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Contratos | Revisão de cláusulas | aguardando_proposta | backoffice | sai | Enviar proposta |
| Responsabilidade civil | Acidente de trânsito | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Responsabilidade civil | Erro médico | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Responsabilidade civil | Dano material | aguardando_proposta | backoffice | sai | Enviar proposta |
| Cobrança | Execução de título | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Cobrança | Ação monitória | aguardando_agendamento | backoffice | sai | Agendar reunião |

**Total: 8 especificações**

---

## EMPRESARIAL (Dr. Carlos)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Societário | Dissolução de sociedade | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Societário | Exclusão de sócio | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Societário | Alteração contratual | aguardando_proposta | backoffice | sai | Enviar proposta |
| Tributário | Planejamento tributário | aguardando_proposta | backoffice | sai | Enviar proposta |
| Tributário | Defesa fiscal | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Tributário | Recuperação de crédito | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Recuperação judicial | Pedido de recuperação | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Recuperação judicial | Falência | aguardando_agendamento | backoffice | sai | Agendar reunião |

**Total: 8 especificações**

---

## SAÚDE (Dra. Patrícia)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Plano de saúde | Negativa de cobertura | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Plano de saúde | Reajuste abusivo | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Plano de saúde | Cancelamento unilateral | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Erro médico | Diagnóstico errado | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Erro médico | Cirurgia mal sucedida | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Medicamentos | Fornecimento pelo SUS | aguardando_agendamento | backoffice | sai | Agendar reunião |
| Medicamentos | Medicamento de alto custo | aguardando_agendamento | backoffice | sai | Agendar reunião |

**Total: 7 especificações**

---

## RESUMO GERAL

| Segmento | Assuntos | Especificações | Persona | Destino |
|----------|---------|---------------|---------|---------|
| Trabalhista | 5 | 14 | Dr. Rafael | backoffice |
| Família | 4 | 11 | Dra. Mariana | backoffice |
| Consumidor | 4 | 10 | Dra. Beatriz | backoffice |
| Cível | 3 | 8 | Dr. André | backoffice |
| Empresarial | 3 | 8 | Dr. Carlos | backoffice |
| Saúde | 3 | 7 | Dra. Patrícia | backoffice |
| Informação | 2 | 5 | — | encerrado |
| Geral | 2 | 5 | — | encerrado |
| **TOTAL** | **26** | **68** | **6 personas** | |

---

## INFORMAÇÃO (sem persona)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Dúvida geral | Como funciona o processo | resolvido | encerrado | sai | Encerrar |
| Dúvida geral | Documentos necessários | resolvido | encerrado | sai | Encerrar |
| Dúvida geral | Prazos e custos | resolvido | encerrado | sai | Encerrar |
| Localização e horário | Horário de funcionamento | resolvido | encerrado | sai | Encerrar |
| Localização e horário | Endereço do escritório | resolvido | encerrado | sai | Encerrar |

**Total: 5 especificações — todas encerrado (resolvido)**

---

## GERAL (sem persona)

| Assunto | Especificação | Status Negócio | Destino | Fila | Ação |
|---------|--------------|---------------|---------|------|------|
| Sem continuidade | Sem interesse | perdido | encerrado | sai | Encerrar |
| Sem continuidade | Desistiu | perdido | encerrado | sai | Encerrar |
| Sem continuidade | Trote | perdido | encerrado | sai | Encerrar |
| Problema de contato | Parou de responder | perdido | encerrado | sai | Encerrar |
| Problema de contato | Número errado | perdido | encerrado | sai | Encerrar |

**Total: 5 especificações — todas encerrado (perdido)**

---

## PIPELINE LINEAR (após classificação)

```
aguardando_agendamento → reuniao_agendada → aguardando_proposta → negociacao → aguardando_contrato → fechado
                                                                                                      ↑
qualquer estado → perdido ←──────────────────────────────────────────────────── reengajar ─────────────┘
```

---

## REGRAS

1. Cada especificação tem exatamente 1 saída (determinístico)
2. Nenhuma especificação tem NULL em status_negocio, destino, fila ou acao
3. Destinos possíveis: `backoffice` (vira caso) ou `encerrado` (sai do fluxo)
4. Tipo `Destino` reduzido a 2 valores — `sidebar` e `relacionamento` removidos
5. Tela2 filtra `.eq('destino', 'backoffice')` — encerrados nunca aparecem no backoffice
6. A maioria entra como `aguardando_agendamento` (primeiro passo = reunião)
7. Casos com valor já estimável entram como `aguardando_proposta` (pula agendamento)
8. `perdido` é acessível de qualquer estado (exceto fechado)
9. `reengajar` só funciona de `perdido` → `aguardando_agendamento`
10. Classificar = decidir destino. Não existe lead classificado sem destino.
