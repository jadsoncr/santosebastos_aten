import React, { useState, useEffect } from 'react';
import { Search, Send, Paperclip, FileText, Download, Play, MoreVertical, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MOCK_CLIENTS, STATUS_COLORS, LEAD_STATUS_COLORS } from '../constants';
import { Client, Message } from '../types';
import { cn } from '../lib/utils';
import { Card, Button, Badge } from './ui/Base';

interface RelationshipViewProps {
  clients: Client[];
  onUpdateClient: (clientId: string, updates: Partial<Client>) => void;
}

export default function RelationshipView({ clients, onUpdateClient }: RelationshipViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients.find(c => c.stage === 'novo' || c.stage === 'qualificado')?.id || clients[0]?.id);
  const [activeFilter, setActiveFilter] = useState<'all' | 'waiting' | 'no-reply'>('all');
  const [isFading, setIsFading] = useState(false);
  
  // Local state for editing
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSegment, setEditSegment] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editNextStep, setEditNextStep] = useState('');
  const [editDossier, setEditDossier] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const relationshipClients = clients.filter(c => c.stage === 'novo' || c.stage === 'qualificado');
  const selectedClient = clients.find(c => c.id === selectedClientId) || relationshipClients[0] || clients[0];

  const now = new Date();
  const waitingThreshold = 8 * 60 * 60 * 1000;
  const noReplyThreshold = 34 * 60 * 60 * 1000;

  const counts = {
    all: relationshipClients.length,
    waiting: relationshipClients.filter(c => {
      const diff = now.getTime() - new Date(c.lastInteraction).getTime();
      return diff >= waitingThreshold && diff < noReplyThreshold;
    }).length,
    noReply: relationshipClients.filter(c => {
      const diff = now.getTime() - new Date(c.lastInteraction).getTime();
      return diff >= noReplyThreshold;
    }).length
  };

  const filteredClients = relationshipClients.filter(c => {
    const diff = now.getTime() - new Date(c.lastInteraction).getTime();
    if (activeFilter === 'waiting') return diff >= waitingThreshold && diff < noReplyThreshold;
    if (activeFilter === 'no-reply') return diff >= noReplyThreshold;
    return true;
  });

  const handleFilterChange = (filter: 'all' | 'waiting' | 'no-reply') => {
    if (filter === activeFilter) return;
    setIsFading(true);
    setTimeout(() => {
      setActiveFilter(filter);
      setIsFading(false);
    }, 150);
  };

  useEffect(() => {
    if (selectedClient) {
      setEditName(selectedClient.name);
      setEditPhone(selectedClient.phone || '');
      setEditSegment(selectedClient.segment || '');
      setEditSubject(selectedClient.subject || '');
      setEditNextStep(selectedClient.specification || '');
      setEditDossier(selectedClient.notes?.[0]?.content || '');
      setIsDirty(false);
    }
  }, [selectedClientId, selectedClient?.id]);

  const handleInputChange = (field: string, value: string) => {
    if (field === 'name') setEditName(value);
    if (field === 'phone') setEditPhone(value);
    if (field === 'segment') setEditSegment(value);
    if (field === 'subject') setEditSubject(value);
    if (field === 'nextStep') setEditNextStep(value);
    if (field === 'dossier') setEditDossier(value);
    setIsDirty(true);
  };

  const handleSaveAndProcess = () => {
    if (!selectedClient) return;

    const updates: Partial<Client> = {
      name: editName,
      phone: editPhone,
      segment: editSegment,
      subject: editSubject,
      specification: editNextStep,
    };

    // If a next step is defined, we move it to negotiation
    if (editNextStep) {
      updates.stage = 'em negociação';
      updates.timeline = [
        ...selectedClient.timeline,
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'status-change',
          description: `Qualificado para: ${editNextStep}. Movido para Operação.`,
          timestamp: new Date()
        }
      ];
    }

    onUpdateClient(selectedClient.id, updates);
    setIsDirty(false);

    // Select another client if the current one was moved out of relationship
    if (updates.stage) {
      const nextClient = relationshipClients.find(c => c.id !== selectedClient.id);
      if (nextClient) setSelectedClientId(nextClient.id);
    }
  };

  const ringColors = {
    hot: 'ring-blue-400',
    warm: 'ring-yellow-400',
    cold: 'ring-gray-300'
  };

  return (
    <div className="flex h-full bg-[#F7F8FA] overflow-hidden text-gray-900 font-sans">
      {/* COLUMN 1: CLIENT LIST */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[#F1F3F6] border-r border-[#E6E8EC]/20">
        <div className="pt-6 px-4 pb-4 border-b border-[#E6E8EC]/20 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Conversas</h2>
          <div className="flex items-center gap-4 mb-4 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => handleFilterChange('all')}
              className={cn(
                "flex items-center gap-1.5 text-[11px] whitespace-nowrap transition-all relative border-b-2 pb-1",
                activeFilter === 'all' 
                  ? "text-blue-600 font-semibold border-blue-400" 
                  : "text-[#9CA3AF] font-normal border-transparent hover:text-gray-500"
              )}
            >
              Todos {counts.all}
              {relationshipClients.some(c => c.status === 'active') && (
                <span className="text-blue-500 text-[8px]">●</span>
              )}
            </button>

            <button
              onClick={() => handleFilterChange('waiting')}
              className={cn(
                "text-[11px] whitespace-nowrap transition-all border-b-2 pb-1",
                activeFilter === 'waiting' 
                  ? "text-blue-600 font-semibold border-blue-400" 
                  : "text-[#9CA3AF] font-normal border-transparent hover:text-gray-500"
              )}
            >
              Aguardando {counts.waiting}
            </button>

            <button
              onClick={() => handleFilterChange('no-reply')}
              className={cn(
                "text-[11px] whitespace-nowrap transition-all border-b-2 pb-1",
                activeFilter === 'no-reply' 
                  ? "text-blue-600 font-semibold border-blue-400" 
                  : "text-[#9CA3AF] font-normal border-transparent hover:text-gray-500"
              )}
            >
              Sem retorno {counts.noReply}
            </button>
          </div>
          <div className="relative mt-3 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              className="w-full pl-9 pr-4 py-2.5 bg-[#F7F8FA] border border-[#E6E8EC]/10 rounded-xl text-xs focus:ring-1 focus:ring-blue-100 outline-none placeholder:text-gray-300 shadow-sm"
            />
          </div>
        </div>

        <div className={cn(
          "flex-1 overflow-y-auto p-2 flex flex-col gap-2 transition-opacity duration-200",
          isFading ? "opacity-0" : "opacity-100"
        )}>
          {filteredClients.map(client => (
            <button
              key={client.id}
              onClick={() => setSelectedClientId(client.id)}
              className={cn(
                "w-full p-[14px] flex gap-3 text-left transition-all border-l-4 rounded-xl",
                selectedClient.id === client.id 
                  ? cn(
                      "bg-white shadow-sm",
                      client.leadStatus === 'hot' ? "border-blue-600" :
                      client.leadStatus === 'warm' ? "border-yellow-400" :
                      "border-gray-400"
                    )
                  : "bg-transparent border-transparent hover:bg-white/50"
              )}
            >
              <div className={cn(
                "relative w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold uppercase ring-2 ring-transparent overflow-hidden",
                client.avatar ? "bg-transparent" : "bg-gray-100 text-gray-300"
              )}>
                {client.avatar ? (
                  <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
                ) : (
                  client.name.charAt(0)
                )}
                <div className={cn(
                  "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white z-10",
                  client.status === 'active' ? "bg-blue-500" :
                  client.status === 'cooling' ? "bg-yellow-500" : "bg-gray-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-bold text-gray-900 truncate text-sm">{client.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      client.leadStatus === 'hot' ? "bg-blue-500" :
                      client.leadStatus === 'warm' ? "bg-yellow-400" : "bg-gray-300"
                    )} />
                    <span className="text-[9px] font-bold text-gray-300 uppercase">
                      {formatDistanceToNow(client.lastInteraction, { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 truncate font-medium">{client.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* COLUMN 2: CHAT AREA */}
      <div className="flex-1 flex flex-col bg-[#F6F8FC]">
        <div className="p-4 border-b border-[#E6E8EC]/20 flex justify-between items-center bg-white z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold border border-gray-100 overflow-hidden shadow-sm">
                {selectedClient.avatar ? (
                  <img src={selectedClient.avatar} alt={selectedClient.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">{selectedClient.name.charAt(0)}</span>
                )}
             </div>
             <div>
                <h3 className="font-bold text-gray-900 text-sm tracking-tight">{selectedClient.name}</h3>
                <p className="text-[10px] text-gray-400 flex items-center font-bold uppercase tracking-widest gap-1">
                   <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", selectedClient.status === 'active' ? "bg-blue-500" : "bg-gray-300")} />
                   Online
                </p>
             </div>
          </div>
          <button className="p-2 text-gray-300 hover:text-gray-600 rounded-full transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#F6F8FC] relative">
          {/* Subtle lighting overlay */}
          <div className="absolute inset-0 bg-radial-gradient from-white/20 to-transparent pointer-events-none" />
          
          {selectedClient.messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex w-full mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.sender === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[65%] rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-md",
                msg.sender === 'user' 
                  ? "bg-[#2563EB] text-white rounded-tr-none" 
                  : "bg-white text-gray-900 rounded-tl-none border border-white"
              )}>
                {msg.type === 'text' && (
                  <p className="text-[13px] leading-relaxed font-medium tracking-tight whitespace-pre-wrap">{msg.content}</p>
                )}
                <span className={cn(
                  "block text-[9px] mt-2 text-right font-bold uppercase tracking-tighter opacity-60",
                  msg.sender === 'user' ? "text-white" : "text-gray-400"
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-white border-t border-[#E6E8EC]/10">
          <div className="flex items-end gap-3 bg-[#F8FAFC] p-3 rounded-2xl border border-gray-100/50 shadow-inner">
            <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
              <Paperclip size={20} />
            </button>
            <textarea 
              rows={1}
              placeholder="Digite sua resposta..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] py-1.5 resize-none max-h-32 font-medium placeholder:text-gray-400"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <button className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-100">
              <Send size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 3: CLIENT PANEL */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[#FBFBFC] border-l border-[#E6E8EC]/20 overflow-y-auto">
        <div className="p-6 space-y-8 pb-32">
          
          {/* 1. IDENTIDADE */}
          <section className="flex flex-col items-center">
            <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center border-[3px] border-white ring-2 mb-4 transition-all overflow-hidden shadow-sm",
                selectedClient.leadStatus === 'hot' ? "ring-blue-100" :
                selectedClient.leadStatus === 'warm' ? "ring-[#FEF3C7]" :
                "ring-gray-100",
                selectedClient.avatar ? "bg-transparent" : "bg-gray-50"
            )}>
              {selectedClient.avatar ? (
                <img src={selectedClient.avatar} alt={selectedClient.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-gray-200">{selectedClient.name.charAt(0)}</span>
              )}
            </div>

            <div className="flex flex-col items-center mb-6">
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md mb-4",
                selectedClient.leadStatus === 'hot' ? "bg-blue-50 text-blue-600" :
                selectedClient.leadStatus === 'warm' ? "bg-[#FEF3C7] text-[#92400E]" :
                "bg-[#E5E7EB] text-gray-500"
              )}>
                {selectedClient.leadStatus === 'hot' ? 'Quente' : 
                 selectedClient.leadStatus === 'warm' ? 'Morno' : 'Frio'}
              </span>
            </div>

            <div className="w-full space-y-4">
               <div>
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">Nome</label>
                  <div className="relative group border-b border-gray-100 pb-1 focus-within:border-blue-600 transition-colors">
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0"
                    />
                    <Zap size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-200 group-focus-within:text-blue-500" />
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">Telefone</label>
                  <div className="relative group border-b border-gray-100 pb-1 focus-within:border-blue-600 transition-colors">
                    <input 
                      type="text"
                      value={editPhone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-900 focus:ring-0"
                    />
                  </div>
               </div>
            </div>
          </section>

          {/* 2. BOTÃO VINCULAÇÃO */}
          <button className="w-full text-center text-[10px] text-blue-600 font-bold uppercase py-2.5 bg-blue-50/30 rounded-xl border border-blue-50 hover:bg-blue-50 transition-colors tracking-tight">
            Vincular identidade existente
          </button>

          {/* 3. CONTEXTO */}
          <div className="pt-2">
             <p className="text-[10px] font-bold text-gray-400 italic">
               Entrada: Trabalhista (via bot)
             </p>
          </div>

          {/* 4. CLASSIFICAÇÃO (CORE) */}
          <section className="space-y-4 pt-4 border-t border-[#E6E8EC]/20">
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Segmento</label>
                   <select 
                    value={editSegment}
                    onChange={(e) => handleInputChange('segment', e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 focus:bg-white focus:ring-1 focus:ring-blue-100 outline-none transition-all appearance-none shadow-sm"
                   >
                      <option value="">Selecionar...</option>
                      <option value="trabalhista">Trabalhista</option>
                      <option value="civel">Cível</option>
                      <option value="familia">Família</option>
                   </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assunto</label>
                   <select 
                    value={editSubject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-[#E6E8EC]/20 rounded-xl p-3 outline-none focus:bg-white focus:ring-1 focus:ring-blue-100 transition-all appearance-none shadow-sm"
                   >
                      <option value="">Selecionar...</option>
                      <option value="demissao">Demissão sem justa causa</option>
                      <option value="fgts">Saque FGTS</option>
                      <option value="horas-extras">Horas Extras</option>
                   </select>
                </div>
                <div className="space-y-1.5 pt-2">
                   <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic decoration-blue-100 underline underline-offset-4">PRÓXIMO PASSO</label>
                   <select 
                    value={editNextStep}
                    onChange={(e) => handleInputChange('nextStep', e.target.value)}
                    className="w-full text-xs font-black bg-blue-50/30 border border-blue-100 text-blue-700 rounded-2xl p-4 outline-none focus:bg-white transition-all shadow-sm"
                   >
                      <option value="">Selecionar ação...</option>
                      <option value="Agendar reunião">Agendar reunião</option>
                      <option value="Enviar proposta">Enviar proposta</option>
                      <option value="Solicitar documentos">Solicitar documentos</option>
                      <option value="Reengajar">Reengajar</option>
                   </select>
                </div>
             </div>
          </section>

          {/* 5. PRÉ-VISUALIZAÇÃO */}
          {editNextStep && (
            <div className="p-4 bg-gray-900 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Vai acontecer:</p>
               <div className="space-y-1">
                  <p className="text-xs font-bold text-white flex justify-between">
                     <span className="opacity-50">Status:</span>
                     <span>Aguardando {editNextStep.toLowerCase()}</span>
                  </p>
                  <p className="text-xs font-bold text-white flex justify-between">
                     <span className="opacity-50">Destino:</span>
                     <span className="text-blue-400">Operação (Backoffice)</span>
                  </p>
               </div>
            </div>
          )}

          {/* 6. DOSSIÊ */}
          <section className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dossiê estratégico</label>
             <textarea 
               value={editDossier}
               onChange={(e) => handleInputChange('dossier', e.target.value)}
               placeholder="Observações importantes sobre o cliente..." 
               className="w-full text-[11px] font-medium bg-white border border-[#E6E8EC]/20 rounded-xl p-4 min-h-[100px] outline-none focus:bg-white transition-all resize-none placeholder:text-gray-200 shadow-sm"
             />
          </section>

          {/* 7. ESTADO & 8. BOTÃO FINAL */}
          <div className="fixed bottom-0 right-0 w-80 p-6 bg-[#FBFBFC] border-t border-[#E6E8EC]/20 space-y-4">
             {isDirty && (
                <p className="text-[10px] font-black text-[#92400E] bg-[#FEF3C7] py-1 px-3 rounded-md uppercase tracking-widest text-center animate-pulse">
                  ⚠️ Alterações não salvas
                </p>
             )}
             <button 
               onClick={handleSaveAndProcess}
               className={cn(
                 "w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95",
                 isDirty || editNextStep
                   ? "bg-[#2563EB] text-white shadow-blue-100 hover:bg-blue-700"
                   : "bg-[#E5E7EB] text-gray-400 cursor-not-allowed"
               )}
             >
                Confirmar e encaminhar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
