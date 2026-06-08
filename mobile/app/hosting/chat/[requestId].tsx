import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight, Send } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import { C } from '@/constants/theme';

interface ChatMsg {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string } | null;
}

export default function HostingChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user, getValidToken } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);
  const hasConnectedBefore = useRef(false);

  useEffect(() => {
    let socket: Socket;
    let authRetried = false;

    const connect = async () => {
      const token = await getValidToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      socket = io(`${API_URL}/hosting-chat`, {
        auth: { token },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        hasConnectedBefore.current = true;
        setConnected(true);
        setError(null);
        socket.emit('hosting-chat:join', { requestId: Number(requestId) });
      });

      socket.on('disconnect', () => {
        setConnected(false);
      });

      socket.on('connect_error', async (err) => {
        const msg = (err.message ?? '').toLowerCase();
        const isAuthErr =
          msg.includes('unauthorized') ||
          msg.includes('forbidden') ||
          msg.includes('401') ||
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

        setError('Connection failed — make sure the request is approved');
      });

      socket.on('hosting-chat:history', (history: ChatMsg[]) => {
        setMessages(history);
      });

      socket.on('hosting-chat:message', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on('exception', (err: any) => {
        setError(err?.message ?? 'Error');
      });
    };

    connect();

    return () => {
      socket?.disconnect();
    };
  }, [requestId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit('hosting-chat:send', {
      requestId: Number(requestId),
      content,
    });
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color="#fff" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>HOSTING</Text>
          <Text style={s.headerTitle}>Private Chat</Text>
        </View>
        <View style={[s.dot, { backgroundColor: connected ? '#4ADE80' : '#F87171' }]} />
      </View>

      {error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
            <Text style={s.backLinkText}>← Go back</Text>
          </TouchableOpacity>
        </View>
      ) : !connected ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={s.connectingText}>
            {hasConnectedBefore.current ? 'Reconnecting…' : 'Connecting…'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>No messages yet. Say hello! 👋</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user?.id === user?.id;
            return (
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                {!isMe && item.user && (
                  <Text style={s.senderName}>{item.user.firstName}</Text>
                )}
                <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>
                  {item.content}
                </Text>
                <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}

      {connected && (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Type a message…"
            placeholderTextColor={C.textMuted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Send size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 22, color: '#fff', letterSpacing: -0.5 },
  dot:         { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },

  list:      { padding: 16, gap: 6, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Inter-Regular', color: C.textMuted, fontSize: 15 },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 2,
  },
  bubbleMe:      { alignSelf: 'flex-end', backgroundColor: C.navy },
  bubbleThem:    { alignSelf: 'flex-start', backgroundColor: '#fff',
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  senderName:    { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.navy, marginBottom: 3 },
  bubbleText:    { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary },
  bubbleTextMe:  { color: '#fff' },
  bubbleTime:    { fontFamily: 'Inter-Regular', fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'right' },
  bubbleTimeMe:  { color: 'rgba(255,255,255,0.55)' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: C.textPrimary,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },

  connectingText: { fontFamily: 'Inter-Regular', color: C.textMuted, fontSize: 14, marginTop: 8 },
  errorText:      { fontFamily: 'Inter-Regular', color: C.error, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  backLink:       { marginTop: 8 },
  backLinkText:   { fontFamily: 'Inter-SemiBold', color: C.navy, fontSize: 14 },
});
