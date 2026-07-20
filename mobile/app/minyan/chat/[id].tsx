import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { API_URL } from '@/src/api/client';
import { getPrayerConfig } from '@/src/utils/prayerIcons';
import { C } from '@/constants/theme';

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

const PRAYER_LABEL: Record<string, string> = {
  shacharit: 'Shacharit', mincha: 'Mincha', maariv: "Ma'ariv", musaf: 'Musaf', other: 'Other',
};

function MinyanChatScreen() {
  const { id, prayerType, city } = useLocalSearchParams<{ id: string; prayerType?: string; city?: string }>();
  const { user, getValidToken } = useAuth();
  const { t } = useTranslation();
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
        socket.emit('minyan-chat:join', { minyanId: Number(id) });
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('minyan-chat:history', (history: ChatMsg[]) => {
        setMessages(history);
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        if (history.length > 0) {
          socket.emit('minyan-chat:mark-read', {
            minyanId: Number(id),
            lastReadId: history[history.length - 1].id,
          });
        }
      });

      socket.on('minyan-chat:newMessage', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        socket.emit('minyan-chat:mark-read', { minyanId: Number(id), lastReadId: msg.id });
      });

      socket.on('chat:online', ({ count }: { count: number }) => {
        setOnlineCount(count);
      });

      socket.on('minyan-chat:cursors', ({ cursors: c }: { cursors: ReadCursor[] }) => {
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
        setLoading(false);
      });
    };

    void connect();

    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (socketRef.current) {
        socketRef.current.emit('minyan-chat:leave', { minyanId: Number(id) });
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (!socketRef.current?.connected) return;
    const now = Date.now();
    if (value.length > 0) {
      if (now - lastTypingEmitRef.current > 3000) {
        socketRef.current.emit('minyan-chat:typing', { minyanId: Number(id) });
        lastTypingEmitRef.current = now;
      }
    } else {
      socketRef.current.emit('minyan-chat:stop-typing', { minyanId: Number(id) });
      lastTypingEmitRef.current = 0;
    }
  };

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current?.connected) return;
    if (content.length > 500) { Alert.alert(t('minyans.chatTooLong'), t('minyans.chatTooLongMsg')); return; }
    socketRef.current.emit('minyan-chat:sendMessage', { minyanId: Number(id), content });
    socketRef.current.emit('minyan-chat:stop-typing', { minyanId: Number(id) });
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
                <Text style={styles.readerInitials}>{r.firstName[0]}{r.lastName[0]}</Text>
              </View>
            ))}
            {readers.length > 4 && <Text style={styles.readerMore}>+{readers.length - 4}</Text>}
          </Pressable>
        )}
      </View>
    );
  };

  const label = PRAYER_LABEL[prayerType ?? ''] ?? 'Minyan';
  const prayerCfg = getPrayerConfig(prayerType ?? '');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={C.navy} strokeWidth={2.5} />
        </Pressable>
        <View style={[styles.headerIconBox, { backgroundColor: prayerCfg.bg }]}>
          <prayerCfg.Icon size={18} color={prayerCfg.color} strokeWidth={2} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{label} Chat{city ? ` — ${city}` : ''}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connected ? '#4caf50' : '#f44336' }]} />
            <Text style={styles.statusText}>
              {connected ? `Live · ${onlineCount} online` : 'Connecting…'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>
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
              <Text style={styles.emptyText}>{t('minyans.chatNoMessages')}</Text>
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
          placeholder={t('minyans.chatPlaceholder')}
          placeholderTextColor={C.textMuted}
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

export default withProtectedRoute(MinyanChatScreen, 'minyanChat');

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 60 : 42,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  backBtn:      {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerIconBox:{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: C.goldBorder, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontFamily: 'Inter-Black', fontSize: 18, color: C.navy },
  statusRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot:          { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textSecondary },
  messageList:  { padding: 16, gap: 4, flexGrow: 1 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe:     { flexDirection: 'row-reverse' },
  avatar:       { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldFaint, borderWidth: 1, borderColor: C.goldBorder, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontFamily: 'Inter-Bold', fontSize: 12, color: C.navy },
  bubble:       { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOther:  {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleMe:     { backgroundColor: C.navy, borderBottomRightRadius: 4 },
  senderName:   { fontFamily: 'Inter-Bold', fontSize: 12, color: C.navy, marginBottom: 4 },
  msgText:      { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary, lineHeight: 20 },
  msgTextMe:    { color: '#fff' },
  msgTime:      { fontFamily: 'Inter-Regular', fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'right' },
  msgTimeMe:    { color: 'rgba(255,255,255,0.6)' },
  readersRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, marginTop: 2, marginBottom: 4, gap: 3 },
  readerAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.goldFaint, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg },
  readerInitials:{ fontSize: 8, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy },
  readerMore:   { fontSize: 10, color: C.textMuted, marginLeft: 2 },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:    { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(11,23,54,0.07)', gap: 10 },
  input:        { flex: 1, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary, maxHeight: 100, borderWidth: 1.5, borderColor: C.goldBorder },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  typingBar:    { paddingHorizontal: 20, paddingVertical: 4, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(11,23,54,0.05)' },
  typingText:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
});
