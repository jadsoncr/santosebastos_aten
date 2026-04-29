/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import RelationshipView from './components/RelationshipView';
import BackofficeView from './components/BackofficeView';
import DashboardView from './components/DashboardView';
import { View, Client } from './types';
import { MOCK_CLIENTS } from './constants';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('relationship');
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);

  const updateClient = (clientId: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c));
  };

  const renderView = () => {
    switch (currentView) {
      case 'relationship':
        return <RelationshipView clients={clients} onUpdateClient={updateClient} />;
      case 'backoffice':
        return <BackofficeView clients={clients} onUpdateClient={updateClient} />;
      case 'dashboard':
        return <DashboardView clients={clients} />;
      default:
        return <RelationshipView clients={clients} onUpdateClient={updateClient} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

