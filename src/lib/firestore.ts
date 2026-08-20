import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import { db, auth } from './auth';
import { UserProfile, Conversation, Message, Memory } from '../types';
import { INITIAL_FOUNDATIONAL_MEMORIES } from './constants';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
export async function testFirestoreConnection(): Promise<boolean> {
  const path = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
      return false;
    }
    // Non-existent document is normal
    return true;
  }
}

// User Profile
export async function saveUserProfile(user: { uid: string; email: string | null; displayName?: string | null }): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const profileDoc: UserProfile = {
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', user.uid), profileDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Conversations
export async function createConversation(
  userId: string,
  title: string = 'Sesión de llamada',
  voice: string = 'Fenrir'
): Promise<string> {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/conversations/${conversationId}`;
  try {
    const conversationData: Conversation = {
      id: conversationId,
      userId,
      title,
      voice,
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userId, 'conversations', conversationId), conversationData);
    return conversationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  updates: Partial<Conversation>
): Promise<void> {
  const path = `users/${userId}/conversations/${conversationId}`;
  try {
    await setDoc(
      doc(db, 'users', userId, 'conversations', conversationId),
      {
        ...updates,
        userId,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const path = `users/${userId}/conversations`;
  try {
    const q = query(
      collection(db, 'users', userId, 'conversations'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const path = `users/${userId}/conversations/${conversationId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'conversations', conversationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToConversations(
  userId: string,
  onUpdate: (conversations: Conversation[]) => void
): () => void {
  const path = `users/${userId}/conversations`;
  const q = query(
    collection(db, 'users', userId, 'conversations'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const convs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      onUpdate(convs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Messages inside Conversation
export async function addMessageToConversation(
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  text: string
): Promise<string> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/conversations/${conversationId}/messages/${messageId}`;
  try {
    const messageData: Message = {
      id: messageId,
      conversationId,
      userId,
      role,
      text: text.slice(0, 4900),
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userId, 'conversations', conversationId, 'messages', messageId), messageData);
    
    // Update conversation updatedAt
    await setDoc(
      doc(db, 'users', userId, 'conversations', conversationId),
      {
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return messageId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getMessages(userId: string, conversationId: string): Promise<Message[]> {
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const q = query(
      collection(db, 'users', userId, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToMessages(
  userId: string,
  conversationId: string,
  onUpdate: (messages: Message[]) => void
): () => void {
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  const q = query(
    collection(db, 'users', userId, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      onUpdate(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Memories
export async function saveMemory(userId: string, fact: string): Promise<string> {
  const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    const memoryData: Memory = {
      id: memoryId,
      userId,
      fact: fact.slice(0, 990),
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userId, 'memories', memoryId), memoryData);
    return memoryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getMemories(userId: string): Promise<Memory[]> {
  const path = `users/${userId}/memories`;
  try {
    const q = query(
      collection(db, 'users', userId, 'memories'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Memory));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'memories', memoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToMemories(
  userId: string,
  onUpdate: (memories: Memory[]) => void
): () => void {
  const path = `users/${userId}/memories`;
  const q = query(
    collection(db, 'users', userId, 'memories'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const mems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Memory));
      onUpdate(mems);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function seedInitialMemories(userId: string): Promise<void> {
  try {
    const existing = await getMemories(userId);
    const existingTexts = new Set(existing.map(m => m.fact.trim()));
    
    for (const fact of INITIAL_FOUNDATIONAL_MEMORIES) {
      if (!existingTexts.has(fact.trim())) {
        await saveMemory(userId, fact);
      }
    }
  } catch (error) {
    console.error("Error seeding initial memories:", error);
  }
}

