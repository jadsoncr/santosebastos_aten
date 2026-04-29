import React from 'react';
import { TrendingUp, Wallet, Target, CreditCard, ChevronRight, BarChart3, Users, Clock, Zap, CheckCircle } from 'lucide-react';
import { Client } from '../types';
import { Card } from './ui/Base';
import { cn } from '../lib/utils';

interface DashboardViewProps {
  clients: Client[];
}

export default function DashboardView({ clients }: DashboardViewProps) {
  const convertedClients = clients.filter(c => c.stage === 'fechado');
  const totalRevenue = convertedClients.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const activeRelationship = clients.filter(c => c.stage === 'novo' || c.stage === 'qualificado').length;
  const inNegotiation = clients.filter(c => c.stage === 'em negociação').length;

  const stats = [
    { label: 'Receita Realizada', value: totalRevenue, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Leads em Qualificação', value: activeRelationship.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pipeline Negociação', value: inNegotiation.toString(), icon: Target, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div>
           <h2 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard de Controle</h2>
           <p className="text-sm font-medium text-gray-500 mt-1">Visão estratégica de relacionamento e backoffice.</p>
        </div>

        {/* INDICADORES GERAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, idx) => (
             <Card key={idx} className="p-6 border-none shadow-sm h-full">
                <div className="flex items-center gap-4 mb-4">
                   <div className={cn("p-3 rounded-xl", stat.bg)}>
                      <stat.icon size={24} className={stat.color} />
                   </div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                </div>
                <p className="text-3xl font-black text-gray-900">
                   {typeof stat.value === 'number' 
                     ? stat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                     : stat.value
                   }
                </p>
             </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* GESTÃO DE RELACIONAMENTO */}
           <section className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Controle de Relacionamento</h3>
              <Card className="p-6 border-none shadow-sm">
                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm font-bold text-gray-700">Leads em Qualificação</span>
                       </div>
                       <span className="text-lg font-black text-gray-900">{activeRelationship}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-orange-400" />
                          <span className="text-sm font-bold text-gray-700">Aguardando Backoffice</span>
                       </div>
                       <span className="text-lg font-black text-gray-900">{inNegotiation}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-50">
                       <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Engajamento Total</p>
                       <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-blue-500" style={{ width: `${(activeRelationship / (activeRelationship + inNegotiation || 1)) * 100}%` }} />
                          <div className="h-full bg-orange-400" style={{ width: `${(inNegotiation / (activeRelationship + inNegotiation || 1)) * 100}%` }} />
                       </div>
                    </div>
                 </div>
              </Card>
           </section>

           {/* DESEMPENHO BACKOFFICE */}
           <section className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Performance Backoffice</h3>
              <Card className="p-6 border-none shadow-sm">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                       <div className="flex items-center gap-3">
                          <Zap size={16} className="text-orange-500" fill="currentColor" />
                          <span className="text-xs font-bold text-gray-700">Pipeline Aberto</span>
                       </div>
                       <span className="text-sm font-black text-orange-600">{inNegotiation}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                       <div className="flex items-center gap-3">
                          <CheckCircle className="text-green-500" size={16} />
                          <span className="text-xs font-bold text-gray-700">Ganhos (Fechado)</span>
                       </div>
                       <span className="text-sm font-black text-green-600">{convertedClients.length}</span>
                    </div>
                    <button className="w-full py-2.5 text-[10px] font-black text-blue-600 bg-blue-50 rounded-xl uppercase tracking-widest hover:bg-blue-100 transition-colors">
                       Extrair Relatório de Conversão
                    </button>
                 </div>
              </Card>
           </section>
        </div>

        {/* ÚLTIMAS CONVERSÕES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Últimas Conversões</h3>
          </div>
          
          <Card className="border-none shadow-sm">
             <div className="divide-y divide-gray-50">
                {convertedClients.map(client => (
                   <div key={client.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                            <TrendingUp className="text-green-600" size={18} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-gray-900">{client.name}</p>
                            <p className="text-[10px] font-medium text-gray-400">{client.lastInteraction.toLocaleDateString()}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <p className="text-base font-black text-gray-900">
                            {client.value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </p>
                         <ChevronRight size={18} className="text-gray-300" />
                      </div>
                   </div>
                ))}
                {convertedClients.length === 0 && (
                  <div className="p-12 text-center text-gray-400 font-bold italic text-xs">
                    Nenhuma conversão registrada no período.
                  </div>
                )}
             </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
