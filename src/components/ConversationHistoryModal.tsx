import React, { useState, useEffect } from 'react';
import { Conversation, Message, Memory } from '../types';
import {
  getConversations,
  getMessages,
  deleteConversation,
  getMemories,
  saveMemory,
  deleteMemory,
  subscribeToConversations,
  subscribeToMemories,
  seedInitialMemories
} from '../lib/firestore';
import { User } from 'firebase/auth';
import {
  X,
  MessageSquare,
  Brain,
  Clock,
  Trash2,
  Plus,
  Search,
  ChevronRight,
  Sparkles,
  PhoneCall,
  User as UserIcon,
  Bot,
  RotateCcw
} from 'lucide-react';

interface Props {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'history' | 'memories';
}

export function ConversationHistoryModal({ user, isOpen, onClose, initialTab = 'history' }: Props) {
  const [activeTab, setActiveTab] = useState<'history' | 'memories'>(initialTab);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Subscribe / load conversations and memories
  useEffect(() => {
    if (!user || !isOpen) return;

    setLoading(true);
    const unsubscribeConv = subscribeToConversations(user.uid, (data) => {
      setConversations(data);
      setLoading(false);
    });

    const unsubscribeMem = subscribeToMemories(user.uid, (data) => {
      setMemories(data);
    });

    return () => {
      unsubscribeConv();
      unsubscribeMem();
    };
  }, [user, isOpen]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (!user || !selectedConversation) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    getMessages(user.uid, selectedConversation.id)
      .then((msgs) => {
        setMessages(msgs);
      })
      .catch((err) => {
        console.error('Error fetching messages:', err);
      })
      .finally(() => {
        setMessagesLoading(false);
      });
  }, [user, selectedConversation]);

  if (!isOpen) return null;

  const handleRestoreFoundationalMemories = async () => {
    if (!user) return;
    setRestoring(true);
    try {
      await seedInitialMemories(user.uid);
    } catch (err) {
      console.error('Failed to restore initial memories:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMemoryText.trim()) return;
    try {
      await saveMemory(user.uid, newMemoryText.trim());
      setNewMemoryText('');
    } catch (err) {
      console.error('Failed to add memory:', err);
    }
  };

  const handleDeleteMemory = async (memId?: string) => {
    if (!user || !memId) return;
    try {
      await deleteMemory(user.uid, memId);
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm('¿Seguro que deseas eliminar esta charla del historial?')) return;
    try {
      await deleteConversation(user.uid, convId);
      if (selectedConversation?.id === convId) {
        setSelectedConversation(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const filteredConversations = conversations.filter(c =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMemories = memories.filter(m =>
    m.fact.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#121212] border border-white/15 rounded-2xl w-full max-w-3xl h-[85vh] max-h-[750px] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#181818]/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#08d9d6]/10 border border-[#08d9d6]/30 flex items-center justify-center text-[#08d9d6]">
              {activeTab === 'history' ? <MessageSquare className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">
                {activeTab === 'history' ? 'Historial de Charlas' : 'Memoria de Jared'}
              </h2>
              <p className="text-xs text-white/50">
                {user ? `Sincronizado con ${user.email}` : 'Inicia sesión para persistir datos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => { setActiveTab('history'); setSelectedConversation(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#08d9d6] text-black font-semibold shadow'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Charlas ({conversations.length})
              </button>
              <button
                onClick={() => { setActiveTab('memories'); setSelectedConversation(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'memories'
                    ? 'bg-[#08d9d6] text-black font-semibold shadow'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Memorias ({memories.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* TAB 1: CONVERSATIONS */}
          {activeTab === 'history' && (
            <>
              {/* Left column / List */}
              <div className={`w-full ${selectedConversation ? 'hidden md:flex md:w-5/12' : 'flex'} flex-col border-r border-white/10 h-full`}>
                {/* Search */}
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar charlas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#08d9d6]/50"
                    />
                  </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {!user ? (
                    <div className="text-center py-12 px-4 text-white/50 text-xs">
                      Conéctate con tu cuenta de Google en Ajustes para sincronizar tus charlas en Firestore.
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-12 px-4 text-white/50 text-xs">
                      {loading ? 'Cargando historial...' : 'No hay charlas registradas todavía. Inicia una llamada o envía un mensaje.'}
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const isSelected = selectedConversation?.id === conv.id;
                      const date = new Date(conv.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#08d9d6]/15 border-[#08d9d6]/40 text-white'
                              : 'bg-white/5 border-white/5 hover:border-white/15 text-white/80 hover:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`p-2 rounded-lg ${conv.durationSeconds ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#08d9d6]/10 text-[#08d9d6]'}`}>
                              {conv.durationSeconds ? <PhoneCall className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-semibold truncate text-white">
                                {conv.title || 'Sesión con Jared'}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {date}
                                </span>
                                {conv.durationSeconds ? (
                                  <span>• {Math.floor(conv.durationSeconds / 60)}m {conv.durationSeconds % 60}s</span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/10 transition-all"
                              title="Eliminar charla"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right column / Message Transcript */}
              <div className={`w-full ${selectedConversation ? 'flex md:w-7/12' : 'hidden md:flex md:w-7/12'} flex-col h-full bg-black/20`}>
                {selectedConversation ? (
                  <>
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedConversation(null)}
                          className="md:hidden p-1.5 text-white/70 hover:text-white rounded-lg bg-white/5"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180" />
                        </button>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {selectedConversation.title || 'Transcripción de la charla'}
                          </h3>
                          <p className="text-[10px] text-white/50">
                            {new Date(selectedConversation.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteConversation(e, selectedConversation.id)}
                        className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messagesLoading ? (
                        <div className="text-center py-12 text-white/50 text-xs">Cargando mensajes...</div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-12 text-white/50 text-xs">
                          No hay mensajes de texto registrados en esta sesión.
                        </div>
                      ) : (
                        messages.map((msg, index) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div
                              key={msg.id || index}
                              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                isUser ? 'bg-white/20 text-white' : 'bg-[#08d9d6]/20 text-[#08d9d6] border border-[#08d9d6]/40'
                              }`}>
                                {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                              </div>
                              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                isUser
                                  ? 'bg-[#08d9d6] text-black font-medium rounded-tr-none'
                                  : 'bg-white/10 text-white rounded-tl-none border border-white/10'
                              }`}>
                                <p>{msg.text}</p>
                                <span className={`block text-[9px] mt-1 ${isUser ? 'text-black/60' : 'text-white/40'}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/40">
                    <MessageSquare className="w-10 h-10 mb-3 text-white/20" />
                    <p className="text-sm">Selecciona una conversación del panel lateral para leer su contenido.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: MEMORIES */}
          {activeTab === 'memories' && (
            <div className="w-full flex-1 flex flex-col h-full p-4 overflow-hidden">
              <div className="mb-4 bg-gradient-to-r from-[#08d9d6]/10 to-transparent p-4 rounded-xl border border-[#08d9d6]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#08d9d6] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Memoria Continua de Jared</h4>
                    <p className="text-xs text-white/70 mt-0.5">
                      Jared guarda y recuerda todo lo compartido desde el primer día.
                    </p>
                  </div>
                </div>
                {user && (
                  <button
                    onClick={handleRestoreFoundationalMemories}
                    disabled={restoring}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#08d9d6]/15 hover:bg-[#08d9d6]/25 border border-[#08d9d6]/40 text-[#08d9d6] text-xs font-medium transition-all shrink-0 disabled:opacity-50"
                    title="Restaurar y sincronizar recuerdos fundacionales desde el inicio"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                    <span>{restoring ? 'Restaurando...' : 'Reponer Recuerdos Base'}</span>
                  </button>
                )}
              </div>

              {/* Add Memory Form */}
              <form onSubmit={handleAddMemory} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Añade un dato o preferencia sobre ti (ej: 'Me gusta la música rock', 'Soy ingeniero')..."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#08d9d6]"
                />
                <button
                  type="submit"
                  disabled={!newMemoryText.trim() || !user}
                  className="px-4 py-2.5 bg-[#08d9d6] text-black font-semibold rounded-xl text-xs flex items-center gap-1.5 hover:bg-[#08d9d6]/90 disabled:opacity-50 transition-all shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </form>

              {/* Memories List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {!user ? (
                  <div className="text-center py-12 text-white/50 text-xs">
                    Inicia sesión en Ajustes para sincronizar tus recuerdos personales con Firestore.
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="text-center py-12 text-white/50 text-xs">
                    No hay recuerdos personalizados guardados todavía.
                  </div>
                ) : (
                  filteredMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3 hover:border-white/20 transition-all group"
                    >
                      <div className="flex items-start gap-2.5 overflow-hidden">
                        <Brain className="w-4 h-4 text-[#08d9d6] shrink-0 mt-0.5" />
                        <span className="text-xs text-white leading-relaxed">{mem.fact}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar recuerdo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
