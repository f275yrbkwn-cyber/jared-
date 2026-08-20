import React from 'react';
import { User } from 'firebase/auth';
import { Memory } from '../types';

interface TextChatDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
}

export function TextChatDrawer({ user, isOpen, onClose, memories }: TextChatDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#121212] border-l border-white/10 z-50 flex flex-col transform transition-transform duration-300 shadow-2xl">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h2 className="text-[#08d9d6] uppercase tracking-widest text-sm font-bold">Chat de Texto</h2>
        <button onClick={onClose} className="text-white/50 hover:text-white p-2">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-white/70 text-sm">
        Esta funcionalidad se encuentra en desarrollo...
      </div>
    </div>
  );
}
