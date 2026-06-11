import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react-native';
import { useAuth } from '@/src/store/auth';
import { API_URL } from '@/src/api/client';

interface ChatMsg {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; profileImageUrl?: string | null };
}

interface ReadCursor {
  userId: number;
  firstName: string;
  lastName: string;
  lastReadId: number;
}

export default function ChatScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const { user, getValidToken } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [cursors, setCursors] = useState<ReadCursor[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);
  const lastTypingEmitRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let socket: Socket;
    let authRetried = false;

    const connect = async () => {
      const token = await getValidToken();
      if (!token) return;

      socket = io(`${API_URL}/chat`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('chat:join', { destinationId: Number(destinationId) });
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('chat:history', (history: ChatMsg[]) => {
        setMessages(history);
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        // Mark all as read
        if (history.length > 0) {
          socket.emit('chat:mark-read', {
            destinationId: Number(destinationId),
            lastReadId: history[history.length - 1].id,
          });
        }
      });

      socket.on('chat:newMessage', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        // Mark as read immediately
        socket.emit('chat:mark-read', {
          destinationId: Number(destinationId),
          lastReadId: msg.id,
        });
      });

      socket.on('chat:online', ({ count }: { count: number }) => {
        setOnlineCount(count);
      });

      socket.on('chat:cursors', ({ cursors: c }: { cursors: ReadCursor[] }) => {
        setCursors(c);
      });

      socket.on('chat:typing', ({ userId, firstName }: { userId: number; firstName: string }) => {
        setTypingUsers((prev) => ({ ...prev, [userId]: firstName }));
        if (typingTimeoutsRef.current[userId]) clearTimeout(typingTimeoutsRef.current[userId]);
        typingTimeoutsRef.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => { const next = { ...prev }; delete next[userId]; return next; });
          delete typingTimeoutsRef.current[userId];
        }, 4000);
      });

      socket.on('chat:stop-typing', ({ userId }: { userId: number }) => {
        if (typingTimeoutsRef.current[userId]) clearTimeout(typingTimeoutsRef.current[userId]);
        delete typingTimeoutsRef.current[userId];
        setTypingUsers((prev) => { const next = { ...prev }; delete next[userId]; return next; });
      });

      socket.on('connect_error', async (err) => {
        const msg = (err.message ?? '').toLowerCase();
        const isAuthErr =
          msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('401') ||
          (err as any).data?.statusCode === 401;
        if (isAuthErr && !authRetried) {
          authRetried = true;
          const freshToken = await getValidToken();
          if (freshToken) {
            socket.auth = { token: freshToken };
            socket.disconnect();
            socket.connect();
            return;
          }
        }
        console.warn('Chat connection error:', err.message);
        setLoading(false);
      });
    };

    connect();

    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { destinationId: Number(destinationId) });
        socketRef.current.disconnect();
      }
    };
  }, [destinationId]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (!socketRef.current?.connected) return;
    const now = Date.now();
    if (value.length > 0) {
      if (now - lastTypingEmitRef.current > 3000) {
        socketRef.current.emit('chat:typing', { destinationId: Number(destinationId) });
        lastTypingEmitRef.current = now;
      }
    } else {
      socketRef.current.emit('chat:stop-typing', { destinationId: Number(destinationId) });
      lastTypingEmitRef.current = 0;
    }
  };

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert('Too long', 'Messages must be under 500 characters.');
      return;
    }
    socketRef.current.emit('chat:sendMessage', { destinationId: Number(destinationId), content });
    socketRef.current.emit('chat:stop-typing', { destinationId: Number(destinationId) });
    lastTypingEmitRef.current = 0;
    setText('');
  };

  const reportMessage = (messageId: number) => {
    Alert.alert('Report Message', 'Flag this message as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report', style: 'destructive',
        onPress: () => {
          socketRef.current?.emit('chat:report', { messageId });
          Alert.alert('Reported', 'Thank you — our team will review this message.');
        },
      },
    ]);
  };

  const showReaders = (readers: ReadCursor[]) => {
    const names = readers.map((r) => `${r.firstName} ${r.lastName}`).join('\n');
    Alert.alert(`Read by ${readers.length}`, names, [{ text: 'OK' }]);
  };

  // For each reader, find the highest of MY messages whose id ≤ their cursor.
  // That message gets the reader's avatar shown under it.
  const readReceiptMap = useMemo(() => {
    const myMsgIds = messages
      .filter((m) => m.user.id === user?.id)
      .map((m) => m.id)
      .sort((a, b) => a - b);

    const map = new Map<number, ReadCursor[]>();
    for (const cursor of cursors) {
      if (cursor.userId === user?.id) continue;
      let targetId: number | null = null;
      for (const msgId of myMsgIds) {
        if (msgId <= cursor.lastReadId) targetId = msgId;
      }
      if (targetId !== null) {
        if (!map.has(targetId)) map.set(targetId, []);
        map.get(targetId)!.push(cursor);
      }
    }
    return map;
  }, [messages, cursors, user?.id]);

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const isMe = item.user.id === user?.id;
    const initials = `${item.user.firstName[0]}${item.user.lastName[0]}`.toUpperCase();
    const readers = isMe ? (readReceiptMap.get(item.id) ?? []) : [];

    return (
      <View>
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Pressable
            style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
            onLongPress={() => !isMe && reportMessage(item.id)}
            delayLongPress={500}
          >
            {!isMe && <Text style={styles.senderName}>{item.user.firstName} {item.user.lastName}</Text>}
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
            <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>
        </View>
        {readers.length > 0 && (
          <Pressable onPress={() => showReaders(readers)} style={styles.readersRow}>
            {readers.slice(0, 4).map((r) => (
              <View key={r.userId} style={styles.readerAvatar}>
                <Text style={styles.readerInitials}>
                  {r.firstName[0]}{r.lastName[0]}
                </Text>
              </View>
            ))}
            {readers.length > 4 && (
              <Text style={styles.readerMore}>+{readers.length - 4}</Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerIconBox}>
          <MessageCircle size={18} color="#fff" strokeWidth={2} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Traveler Chat{city ? ` — ${city}` : ''}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connected ? '#4caf50' : '#f44336' }]} />
            <Text style={styles.statusText}>
              {connected ? `Live · ${onlineCount} online` : 'Connecting…'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1a3a6b" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MessageCircle size={48} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={styles.emptyText}>No messages yet.{'\n'}Be the first to say hello!</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {Object.keys(typingUsers).length > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>
            {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing…
          </Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type a message…"
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || !connected) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || !connected}
        >
          <Send size={18} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f4ff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#1a3a6b', paddingTop: Platform.OS === 'ios' ? 60 : 42, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { marginRight: 12 },
  headerIconBox:{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot:          { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:   { fontSize: 12, color: '#a8c4e8' },
  messageList:  { padding: 16, gap: 4, flexGrow: 1 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe:     { flexDirection: 'row-reverse' },
  avatar:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#a8c4e8', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 12, fontWeight: '700', color: '#1a3a6b' },
  bubble:       { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOther:  { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleMe:     { backgroundColor: '#1a3a6b', borderBottomRightRadius: 4 },
  senderName:   { fontSize: 12, fontWeight: '700', color: '#1a3a6b', marginBottom: 4 },
  msgText:      { fontSize: 15, color: '#1a1a2e', lineHeight: 20 },
  msgTextMe:    { color: '#fff' },
  msgTime:      { fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'right' },
  msgTimeMe:    { color: 'rgba(255,255,255,0.6)' },
  readersRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, marginTop: 2, marginBottom: 4, gap: 3 },
  readerAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#a8c4e8', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#f0f4ff' },
  readerInitials:{ fontSize: 8, fontWeight: '800', color: '#1a3a6b' },
  readerMore:   { fontSize: 10, color: '#888', marginLeft: 2 },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:    { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 10 },
  input:        { flex: 1, backgroundColor: '#f0f4ff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a2e', maxHeight: 100 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a3a6b', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  typingBar:    { paddingHorizontal: 20, paddingVertical: 4, backgroundColor: '#fff' },
  typingText:   { fontSize: 12, color: '#888', fontStyle: 'italic' },
});
