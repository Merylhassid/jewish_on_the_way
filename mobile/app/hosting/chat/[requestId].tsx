import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Flag, Send, ShieldOff, Users } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import client, { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import { withProtectedRoute } from '@/src/auth/auth-gates';
import { C } from '@/constants/theme';

interface ChatMsg {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string } | null;
}

interface ReadCursor {
  userId: number;
  firstName: string;
  lastName: string;
  lastReadId: number;
}

function HostingChatScreen() {
  const { t } = useTranslation();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user, getValidToken } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [otherUser, setOtherUser] = useState<{ id: number; firstName: string; lastName: string } | null>(null);
  const [cursors, setCursors] = useState<ReadCursor[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);
  const hasConnectedBefore = useRef(false);
  const lastTypingEmitRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let socket: Socket;
    let authRetried = false;

    const connect = async () => {
      const token = await getValidToken();
      if (!token) { setError(t('hosting.notAuthenticated')); return; }

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

      socket.on('disconnect', () => setConnected(false));

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
        setError(t('hosting.connectionFailed'));
      });

      socket.on('hosting-chat:participant', (participant: { id: number; firstName: string; lastName: string } | null) => {
        setOtherUser(participant);
      });

      socket.on('hosting-chat:history', (history: ChatMsg[]) => {
        setMessages(history);
        if (history.length > 0) {
          socket.emit('hosting-chat:mark-read', {
            requestId: Number(requestId),
            lastReadId: history[history.length - 1].id,
          });
        }
      });

      socket.on('hosting-chat:message', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
        socket.emit('hosting-chat:mark-read', { requestId: Number(requestId), lastReadId: msg.id });
      });

      socket.on('hosting-chat:online', ({ count }: { count: number }) => {
        setOnlineCount(count);
      });

      socket.on('hosting-chat:cursors', ({ cursors: c }: { cursors: ReadCursor[] }) => {
        setCursors(c);
      });

      socket.on('hosting-chat:typing', ({ userId, firstName }: { userId: number; firstName: string }) => {
        setTypingUsers((prev) => ({ ...prev, [userId]: firstName }));
        if (typingTimeoutsRef.current[userId]) clearTimeout(typingTimeoutsRef.current[userId]);
        typingTimeoutsRef.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => { const next = { ...prev }; delete next[userId]; return next; });
          delete typingTimeoutsRef.current[userId];
        }, 4000);
      });

      socket.on('hosting-chat:stop-typing', ({ userId }: { userId: number }) => {
        if (typingTimeoutsRef.current[userId]) clearTimeout(typingTimeoutsRef.current[userId]);
        delete typingTimeoutsRef.current[userId];
        setTypingUsers((prev) => { const next = { ...prev }; delete next[userId]; return next; });
      });

      socket.on('exception', (err: any) => setError(err?.message ?? t('common.error')));
    };

    connect();
    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      socket?.disconnect();
    };
  }, [requestId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (!socketRef.current?.connected) return;
    const now = Date.now();
    if (value.length > 0) {
      if (now - lastTypingEmitRef.current > 3000) {
        socketRef.current.emit('hosting-chat:typing', { requestId: Number(requestId) });
        lastTypingEmitRef.current = now;
      }
    } else {
      socketRef.current.emit('hosting-chat:stop-typing', { requestId: Number(requestId) });
      lastTypingEmitRef.current = 0;
    }
  };

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit('hosting-chat:send', { requestId: Number(requestId), content });
    socketRef.current.emit('hosting-chat:stop-typing', { requestId: Number(requestId) });
    lastTypingEmitRef.current = 0;
    setText('');
  };

  // For a 2-person chat, show "Seen" under own messages if the other person read them
  const otherUserCursor = cursors.find((c) => c.userId !== user?.id);

  const handleBlock = () => {
    if (!otherUser) return;
    Alert.alert(
      t('hosting.blockUserTitle', { name: otherUser.firstName }),
      t('hosting.blockUserMsg'),
      [
        { text: t('hosting.cancelBtn'), style: 'cancel' },
        {
          text: t('hosting.blockBtn'), style: 'destructive',
          onPress: async () => {
            try {
              await client.post(`/users/${otherUser.id}/block`);
              Alert.alert(t('hosting.blockedTitle'), t('hosting.blockedMsg', { name: otherUser.firstName }));
              router.back();
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.response?.data?.message ?? t('hosting.couldNotBlock'));
            }
          },
        },
      ],
    );
  };

  const handleReport = () => {
    Alert.alert(
      t('hosting.reportConvTitle'),
      t('hosting.reportConvMsg'),
      [
        { text: t('hosting.cancelBtn'), style: 'cancel' },
        {
          text: t('hosting.reportBtn'), style: 'destructive',
          onPress: () => {
            socketRef.current?.emit('hosting-chat:report', { requestId: Number(requestId) });
            Alert.alert(t('hosting.reportedTitle'), t('hosting.reportedMsg'));
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronRight size={20} color={C.navy} strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>HOSTING</Text>
          <Text style={s.headerTitle}>{t('hosting.privateChatTitle')}</Text>
        </View>
        {otherUser && (
          <Pressable onPress={handleBlock} hitSlop={12} style={s.reportBtn}>
            <ShieldOff size={16} color={C.error} strokeWidth={2.2} />
          </Pressable>
        )}
        <Pressable onPress={handleReport} hitSlop={12} style={s.reportBtn}>
          <Flag size={16} color={C.error} strokeWidth={2.2} />
        </Pressable>
        <View style={s.onlinePill}>
          <Users size={11} color={C.goldMuted} strokeWidth={2.5} />
          <Text style={s.onlineText}>{onlineCount}</Text>
          <View style={[s.dot, { backgroundColor: connected ? '#4ADE80' : '#F87171' }]} />
        </View>
      </View>

      {error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
            <Text style={s.backLinkText}>{t('hosting.goBack')}</Text>
          </TouchableOpacity>
        </View>
      ) : !connected ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={s.connectingText}>
            {hasConnectedBefore.current ? t('hosting.reconnecting') : t('hosting.connecting')}
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
              <Text style={s.emptyText}>{t('hosting.noMessagesYet')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user?.id === user?.id;
            const seenByOther =
              isMe && otherUserCursor && otherUserCursor.lastReadId >= item.id;
            // Show "Seen" only under the last message the other person has read
            const isLastSeenMsg =
              isMe && otherUserCursor && otherUserCursor.lastReadId === item.id;

            return (
              <View>
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                  {!isMe && item.user && (
                    <Text style={s.senderName}>{item.user.firstName}</Text>
                  )}
                  <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{item.content}</Text>
                  <Text style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {isLastSeenMsg && otherUserCursor && (
                  <View style={s.seenRow}>
                    <View style={s.seenAvatar}>
                      <Text style={s.seenInitials}>
                        {otherUserCursor.firstName[0]}{otherUserCursor.lastName[0]}
                      </Text>
                    </View>
                    <Text style={s.seenLabel}>{t('hosting.seenLabel')}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {connected && Object.keys(typingUsers).length > 0 && (
        <View style={s.typingBar}>
          <Text style={s.typingText}>
            {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? t('hosting.typingOne') : t('hosting.typingMany')}
          </Text>
        </View>
      )}

      {connected && (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder={t('hosting.messagePlaceholder')}
            placeholderTextColor={C.textMuted}
            value={text}
            onChangeText={handleTextChange}
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

export default withProtectedRoute(HostingChatScreen, 'hosting');

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.goldBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.goldBorder,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  eyebrow:     { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldEyebrow, letterSpacing: 2.5, marginBottom: 2 },
  headerTitle: { fontFamily: 'Inter-Black', fontSize: 24, color: C.navy },
  reportBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  onlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.goldBorder,
    marginBottom: 2,
  },
  onlineText: { fontFamily: 'Inter-Bold', fontSize: 13, color: C.navy },
  dot:        { width: 8, height: 8, borderRadius: 4 },

  list:      { padding: 16, gap: 6, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'Inter-Regular', color: C.textMuted, fontSize: 15 },

  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 2,
  },
  bubbleMe:     { alignSelf: 'flex-end', backgroundColor: C.navy },
  bubbleThem:   { alignSelf: 'flex-start', backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(11,23,54,0.08)',
    shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  senderName:   { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.navy, marginBottom: 3 },
  bubbleText:   { fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary },
  bubbleTextMe: { color: '#fff' },
  bubbleTime:   { fontFamily: 'Inter-Regular', fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },

  seenRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, marginBottom: 4, gap: 4 },
  seenAvatar:   { width: 16, height: 16, borderRadius: 8, backgroundColor: C.gold + '30', justifyContent: 'center', alignItems: 'center' },
  seenInitials: { fontSize: 7, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: C.navy },
  seenLabel:    { fontFamily: 'Inter-Regular', fontSize: 10, color: C.textMuted },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: 'rgba(11,23,54,0.07)',
  },
  input: {
    flex: 1, backgroundColor: C.bg, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary,
    maxHeight: 100, borderWidth: 1.5, borderColor: C.goldBorder,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },

  connectingText: { fontFamily: 'Inter-Regular', color: C.textMuted, fontSize: 14, marginTop: 8 },
  errorText:      { fontFamily: 'Inter-Regular', color: C.error, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  backLink:       { marginTop: 8 },
  backLinkText:   { fontFamily: 'Inter-SemiBold', color: C.navy, fontSize: 14 },
  typingBar:      { paddingHorizontal: 20, paddingVertical: 4, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(11,23,54,0.05)' },
  typingText:     { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
});
