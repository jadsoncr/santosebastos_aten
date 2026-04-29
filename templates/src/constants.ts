import { Client, ClientStatus, LeadStatus, LeadStage } from './types';

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Ana Silva',
    lastMessage: 'Olá, gostaria de saber mais sobre a proposta.',
    lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h ago
    status: 'active',
    leadStatus: 'hot',
    stage: 'novo',
    channel: 'WhatsApp',
    value: 5000,
    notes: [
      { id: 'n1', content: 'Interessada no plano premium.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) }
    ],
    timeline: [
      { id: 't1', type: 'message', description: 'Recebeu proposta inicial', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
      { id: 't2', type: 'status-change', description: 'Status alterado para Ativo', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) }
    ],
    messages: [
      { id: 'm1', type: 'text', content: 'Olá, gostaria de saber mais sobre a proposta.', sender: 'client', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      { id: 'm2', type: 'text', content: 'Claro Ana! Vou te enviar os detalhes agora.', sender: 'user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5) },
      { id: 'm3', type: 'document', content: 'https://example.com/proposta.pdf', fileName: 'Proposta_Comercial.pdf', sender: 'user', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.2) }
    ],
    propensity: 4,
    area: 'trabalhista',
    priority: 'MEDIO',
    phone: '(11) 98765-4321',
    email: 'ana.silva@example.com',
    type: 'PROSPECTO',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150'
  },
  {
    id: '2',
    name: 'Roberto Santos',
    lastMessage: 'Pode me ligar amanhã?',
    lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5h ago
    status: 'active',
    leadStatus: 'warm',
    stage: 'em negociação',
    channel: 'WhatsApp',
    value: 2500,
    notes: [],
    timeline: [],
    messages: [
       { id: 'm4', type: 'text', content: 'Pode me ligar amanhã?', sender: 'client', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) }
    ],
    propensity: 7,
    area: 'familia',
    priority: 'ALTA',
    type: 'REATIVADO'
  },
  {
    id: '3',
    name: 'Mariana Oliveira',
    lastMessage: 'Ainda estou pensando no orçamento.',
    lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2d ago
    status: 'cooling',
    leadStatus: 'cold',
    stage: 'qualificado',
    channel: 'Direct',
    value: 1200,
    notes: [],
    timeline: [],
    messages: [],
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150&h=150'
  },
  {
    id: '4',
    name: 'Carlos Mendes',
    lastMessage: 'Mensagem não respondida.',
    lastInteraction: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4), // 4d ago
    status: 'no-reply',
    leadStatus: 'cold',
    stage: 'novo',
    channel: 'Email',
    value: 0,
    notes: [],
    timeline: [],
    messages: [],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150'
  }
];

export const STATUS_COLORS: Record<ClientStatus, string> = {
  active: 'bg-blue-100 text-blue-700',
  cooling: 'bg-yellow-100 text-yellow-700',
  'no-reply': 'bg-gray-100 text-gray-700'
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  hot: 'bg-orange-100 text-orange-700',
  warm: 'bg-yellow-100 text-yellow-700',
  cold: 'bg-blue-100 text-blue-700'
};
