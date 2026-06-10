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
import { API_URL } from '@/src/api/client';
import { getPrayerConfig } from '@/src/utils/prayerIcons';

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

export default function MinyanChatScreen() {
  const { id, prayerType, city } = useLocalSearchParams<{ id: string; prayerType?: string; city?: string }>();
  const { user, getValidToken } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [cursors, setCursors] = useState<ReadCursor[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

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
      if (socketRef.current) {
        socketRef.current.emit('minyan-chat:leave', { minyanId: Number(id) });
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current?.connected) return;
    if (content.length > 500) { Alert.alert(t('minyans.chatTooLong'), t('minyans.chatTooLongMsg')); return; }
    socketRef.current.emit('minyan-chat:sendMessage', { minyanId: Number(id), content });
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
          <View style={styles.readersRow}>
            {readers.slice(0, 4).map((r) => (
              <View key={r.userId} style={styles.readerAvatar}>
                <Text style={styles.readerInitials}>{r.firstName[0]}{r.lastName[0]}</Text>
              </View>
            ))}
            {readers.length > 4 && <Text style={styles.readerMore}>+{readers.length - 4}</Text>}
          </View>
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
          <ArrowLeft size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={[styles.headerIconBox, { backgroundColor: prayerCfg.color + '30' }]}>
          <prayerCfg.Icon size={18} color="#fff" strokeWidth={2} />
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
              <Text style={styles.emptyText}>{t('minyans.chatNoMessages')}</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('minyans.chatPlaceholder')}
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
  headerIconBox:{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#fff' },
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
});
