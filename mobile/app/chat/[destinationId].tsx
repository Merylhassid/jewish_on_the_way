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
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeButton from '@/src/components/HomeButton';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/src/store/auth';
import { API_URL } from '@/src/api/client';

interface ChatMsg {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    profileImageUrl?: string | null;
  };
}

export default function ChatScreen() {
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let socket: Socket;

    const connect = async () => {
      const token = await AsyncStorage.getItem('token');
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
      });

      socket.on('chat:newMessage', (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      });

      socket.on('connect_error', (err) => {
        console.warn('Chat connection error:', err.message);
        setLoading(false);
      });
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { destinationId: Number(destinationId) });
        socketRef.current.disconnect();
      }
    };
  }, [destinationId]);

  const sendMessage = () => {
    const content = text.trim();
    if (!content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert('Too long', 'Messages must be under 500 characters.');
      return;
    }
    socketRef.current.emit('chat:sendMessage', {
      destinationId: Number(destinationId),
      content,
    });
    setText('');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // req 5.5 — report a message
  const reportMessage = (messageId: number) => {
    Alert.alert('Report Message', 'Flag this message as inappropriate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => {
          socketRef.current?.emit('chat:report', { messageId });
          Alert.alert('Reported', 'Thank you — our team will review this message.');
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const isMe = item.user.id === user?.id;
    const initials = `${item.user.firstName[0]}${item.user.lastName[0]}`.toUpperCase();

    return (
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
          {!isMe && (
            <Text style={styles.senderName}>{item.user.firstName} {item.user.lastName}</Text>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{formatTime(item.createdAt)}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <HomeButton />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>💬 Traveler Chat{city ? ` — ${city}` : ''}</Text>
          <View style={styles.statusDot}>
            <View style={[styles.dot, { backgroundColor: connected ? '#4caf50' : '#f44336' }]} />
            <Text style={styles.statusText}>{connected ? 'Live' : 'Connecting…'}</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
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
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>No messages yet.{'\n'}Be the first to say hello!</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
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
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f4ff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: '#1a3a6b', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:      { marginRight: 12 },
  backText:     { fontSize: 24, color: '#fff' },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  statusDot:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot:          { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:   { fontSize: 12, color: '#a8c4e8' },
  messageList:  { padding: 16, gap: 10, flexGrow: 1 },
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
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 10 },
  input:        { flex: 1, backgroundColor: '#f0f4ff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a2e', maxHeight: 100 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a3a6b', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon:     { color: '#fff', fontSize: 16 },
});
