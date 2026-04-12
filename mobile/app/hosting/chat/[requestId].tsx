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
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';

interface ChatMsg {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string } | null;
}

export default function HostingChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let socket: Socket;

    AsyncStorage.getItem('token').then((token) => {
      socket = io(`${API_URL}/hosting-chat`, {
        auth: { token },
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('hosting-chat:join', { requestId: Number(requestId) });
      });

      socket.on('connect_error', () => {
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
    });

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🏠 Hosting Chat</Text>
        <View style={[styles.dot, { backgroundColor: connected ? '#4caf50' : '#ccc' }]} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Go back</Text>
          </TouchableOpacity>
        </View>
      ) : !connected ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a3a6b" />
          <Text style={styles.connectingText}>Connecting…</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user?.id === user?.id;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                {!isMe && item.user && (
                  <Text style={styles.senderName}>{item.user.firstName}</Text>
                )}
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                  {item.content}
                </Text>
                <Text style={styles.bubbleTime}>
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

      {/* Input */}
      {connected && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor="#aaa"
            value={text}
            onChangeText={setText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header: {
    backgroundColor: '#1a3a6b',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 15 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 2,
  },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#1a3a6b' },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  senderName: { fontSize: 11, fontWeight: '700', color: '#1a3a6b', marginBottom: 2 },
  bubbleText: { fontSize: 15, color: '#1a1a2e' },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f4ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a2e',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a3a6b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  connectingText: { color: '#888', fontSize: 14, marginTop: 8 },
  errorText: { color: '#e53935', fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  backLink: { marginTop: 8 },
  backLinkText: { color: '#1a3a6b', fontSize: 14, fontWeight: '600' },
});
