import React from 'react';
import { Target, CheckCircle, XCircle, ChevronRight, MessageSquare, Clock, Zap } from 'lucide-react';
import { STATUS_COLORS } from '../constants';
import { Card, Badge } from './ui/Base';
import { cn } from '../lib/utils';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Client } from '../types';

interface BackofficeViewProps {
  clients: Client[];
  onUpdateClient: (clientId: string, updates: Partial<Client>) => void;
}

export default function BackofficeView({ clients, onUpdateClient }: BackofficeViewProps) {
  const stats = [
    { label: 'Em Negociação', value: clients.filter(c => c.stage === 'em negociação').length.toString(), sub: 'Aguardando fechamento', icon: Target, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Reuniões Agendadas', value: clients.filter(c => c.timeline.some(t => t.type === 'appointment' && c.stage === 'em negociação')).length.toString(), sub: 'Próximos dias', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Contratos Fechados', value: clients.filter(c => c.stage === 'fechado').length.toString(), sub: 'Este mês', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Taxa de Perda', value: '12%', sub: 'últimos 7 dias', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const negotiationClients = clients.filter(c => c.stage === 'em negociação' || c.stage === 'fechado');

  const groupedClients = [
    { 
      label: 'Propostas em Aberto', 
      sub: 'Aguardando decisão do cliente',
      clients: negotiationClients.filter(c => c.stage === 'em negociação') 
    },
    { 
      label: 'Ganhos Recentemente', 
      sub: 'Contratos validados',
      clients: negotiationClients.filter(c => c.stage === 'fechado') 
    }
  ];

  const getUrgencyInfo = (lastInteraction: Date) => {
    const hours = differenceInHours(new Date(), lastInteraction);
    if (hours < 2) return { text: 'Ativo agora', color: 'text-green-500' };
    if (hours < 24) return { text: 'Aguardando resposta', color: 'text-blue-500' };
    return { text: `Sem retorno há ${Math.floor(hours/24)} dias`, color: 'text-orange-500' };
  };

  const getActionHint = (client: Client) => {
    if (client.stage === 'fechado') return 'Contrato Ativo';
    return 'Finalizar Fechamento';
  };

  const handleCloseContract = (clientId: string) => {
    onUpdateClient(clientId, { 
      stage: 'fechado',
      status: 'active',
      timeline: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'status-change',
          description: 'Contrato fechado com sucesso!',
          timestamp: new Date()
        }
      ]
    });
  };

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex justify-between items-end">
           <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Operação em tempo real</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Gestão de propostas e fechamentos (Backoffice)</p>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-gray-100 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atualizado agora</span>
           </div>
        </div>

        {/* TOPO: INDICADORES DECISÓRIOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat, idx) => (
            <Card key={idx} className="p-6 border-none shadow-sm hover:shadow-md transition-shadow h-full">
               <div className="flex flex-col gap-4">
                  <div className={cn("p-2 rounded-lg w-fit", stat.bg)}>
                     <stat.icon size={20} className={stat.color} />
                  </div>
                  <div>
                     <p className="text-4xl font-black text-gray-900 mb-1">{stat.value}</p>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                     <p className={cn("text-[11px] font-bold mt-2", stat.color)}>{stat.sub}</p>
                  </div>
               </div>
            </Card>
          ))}
        </div>

        {/* ÁREA PRINCIPAL: LISTA OPERACIONAL */}
        <div className="space-y-12">
           {groupedClients.map((group) => (
              <section key={group.label}>
                 <div className="flex items-baseline justify-between mb-6 border-b border-gray-200 pb-2">
                    <div className="flex items-baseline gap-3">
                       <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">{group.label}</h3>
                       <span className="text-[10px] font-bold text-gray-400 uppercase italic">{group.sub}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{group.clients.length} casos</span>
                 </div>
                 
                 {group.clients.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                       {group.clients.map(client => {
                         const urgency = getUrgencyInfo(client.lastInteraction);
                         return (
                           <Card key={client.id} className="p-0 border-none hover:ring-2 hover:ring-blue-100 transition-all group">
                              <div className="p-5 flex items-center justify-between">
                                 <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center font-black text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                       {client.name.charAt(0)}
                                    </div>
                                    <div>
                                       <p className="text-base font-bold text-gray-900">{client.name}</p>
                                       <div className="flex items-center gap-3 mt-1">
                                          <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                                             <Clock size={12} strokeWidth={3} />
                                             {formatDistanceToNow(client.lastInteraction, { addSuffix: true, locale: ptBR })}
                                          </p>
                                          <span className="w-1 h-1 rounded-full bg-gray-200" />
                                          <p className={cn("text-[11px] font-black uppercase tracking-tight", urgency.color)}>
                                             {urgency.text}
                                          </p>
                                       </div>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-8">
                                    <div className="text-right">
                                       <p className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Valor Est.</p>
                                       <p className="text-sm font-black text-gray-900">
                                          {client.value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                       </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                       <Badge className={cn("text-[9px] font-black tracking-widest uppercase", client.stage === 'fechado' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                                          {client.stage}
                                       </Badge>
                                       <div className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Zap size={10} fill="currentColor" />
                                          {getActionHint(client)}
                                       </div>
                                    </div>
                                    <button 
                                      onClick={() => client.stage === 'em negociação' && handleCloseContract(client.id)}
                                      className={cn(
                                        "p-3 rounded-xl transition-all transform group-hover:translate-x-1",
                                        client.stage === 'fechado' 
                                          ? "bg-green-50 text-green-600" 
                                          : "bg-gray-50 text-gray-300 group-hover:bg-blue-600 group-hover:text-white"
                                      )}
                                    >
                                       {client.stage === 'fechado' ? <CheckCircle size={20} strokeWidth={3} /> : <ChevronRight size={20} strokeWidth={3} />}
                                    </button>
                                 </div>
                              </div>
                           </Card>
                         );
                       })}
                    </div>
                 ) : (
                    <div className="py-16 flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-100 rounded-3xl">
                       <div className="p-4 bg-green-50 rounded-full mb-4">
                          <CheckCircle className="text-green-500" size={32} />
                       </div>
                       <p className="text-base font-bold text-gray-900">Operação sob controle</p>
                       <p className="text-sm text-gray-400 font-medium">Nenhum cliente precisa de atenção agora</p>
                    </div>
                 )}
              </section>
           ))}
        </div>
      </div>
    </div>
  );
}
