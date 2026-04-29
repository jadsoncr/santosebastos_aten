export type ClientStatus = 'active' | 'cooling' | 'no-reply';
export type LeadStatus = 'hot' | 'warm' | 'cold';
export type LeadStage = 'novo' | 'qualificado' | 'em negociação' | 'fechado' | 'perdido';

export interface Message {
  id: string;
  type: 'text' | 'image' | 'document' | 'audio';
  content: string;
  sender: 'user' | 'client';
  timestamp: Date;
  fileName?: string;
}

export interface ClientNote {
  id: string;
  content: string;
  timestamp: Date;
}

export interface TimelineEvent {
  id: string;
  type: 'message' | 'appointment' | 'proposal' | 'status-change';
  description: string;
  timestamp: Date;
}

export interface Client {
  id: string;
  name: string;
  lastMessage: string;
  lastInteraction: Date;
  status: ClientStatus;
  leadStatus: LeadStatus;
  stage: LeadStage;
  channel: string;
  value?: number;
  notes: ClientNote[];
  timeline: TimelineEvent[];
  messages: Message[];
  // New fields from screenshots
  propensity?: number;
  area?: string;
  priority?: 'BAIXA' | 'MEDIO' | 'ALTA';
  phone?: string;
  email?: string;
  segment?: string;
  subject?: string;
  specification?: string;
  estimatedValue?: number;
  entryValue?: number;
  contractSigned?: boolean;
  type?: 'PROSPECTO' | 'REATIVADO';
  avatar?: string;
}

export type View = 'relationship' | 'backoffice' | 'dashboard';
