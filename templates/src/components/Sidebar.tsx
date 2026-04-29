import React from 'react';
import { MessageSquare, LayoutGrid, DollarSign, Settings, LogOut, Zap } from 'lucide-react';
import { View } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'relationship', label: 'Relacionamento', icon: MessageSquare },
    { id: 'backoffice', label: 'Backoffice', icon: LayoutGrid },
    { id: 'dashboard', label: 'Dashboard', icon: DollarSign },
  ];

  return (
    <aside className="w-20 lg:w-64 flex-shrink-0 flex flex-col bg-white border-r border-gray-100 z-50 transition-all">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start px-6 border-b border-gray-50">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
           <Zap size={20} className="text-white fill-white" />
        </div>
        <span className="ml-3 font-black text-xl text-gray-900 hidden lg:block tracking-tighter">BRO Resolve</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as View)}
            className={cn(
              "w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-all group",
              currentView === item.id 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            )}
          >
            <item.icon size={22} className={cn("transition-transform group-active:scale-90", currentView === item.id ? "scale-110" : "")} />
            <span className="ml-3 font-semibold hidden lg:block">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-2 border-t border-gray-50">
        <button className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors">
          <Settings size={22} />
          <span className="ml-3 font-semibold hidden lg:block">Configurações</span>
        </button>
        <button className="w-full flex items-center justify-center lg:justify-start p-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
          <LogOut size={22} />
          <span className="ml-3 font-semibold hidden lg:block">Sair</span>
        </button>
      </div>
    </aside>
  );
}
