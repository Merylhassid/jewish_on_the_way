import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft, Image as ImageIcon, MessageCircle, MoreVertical, Plus, X } from 'lucide-react-native';
import { useAuth } from '@/src/store/auth';
import { useRequireAuth } from '@/src/auth/auth-gates';
import client, { API_URL } from '@/src/api/client';
import { C } from '@/constants/theme';

interface ChatMsg {
  id: number;
  content: string;
  category?: PostCategory | null;
  imageUrl?: string | null;
  parentMessageId?: number | null;
  comments?: ChatMsg[];
  likeCount?: number;
  likedByMe?: boolean;
  likedBy?: ChatUser[];
  createdAt: string;
  user: ChatUser;
}

interface ChatUser {
  id?: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
}

interface ReadCursor {
  userId: number;
  firstName: string;
  lastName: string;
  lastReadId: number;
}

type PostCategory =
  | 'hotels'
  | 'attractions'
  | 'food'
  | 'flights'
  | 'entertainment'
  | 'transport'
  | 'synagogues'
  | 'general';
type TabKey = 'all' | PostCategory;

function getTabs(t: (key: string) => string): { key: TabKey; label: string }[] {
  return [
    { key: 'all', label: t('community.catAll') },
    { key: 'hotels', label: t('community.catHotels') },
    { key: 'attractions', label: t('community.catAttractions') },
    { key: 'food', label: t('community.catFood') },
    { key: 'flights', label: t('community.catFlights') },
    { key: 'entertainment', label: t('community.catEntertainment') },
    { key: 'transport', label: t('community.catTransport') },
    { key: 'synagogues', label: t('community.catSynagogues') },
    { key: 'general', label: t('community.catGeneral') },
  ];
}

function getPostCategories(t: (key: string) => string): { key: PostCategory; label: string }[] {
  return [
    { key: 'hotels', label: t('community.catHotels') },
    { key: 'attractions', label: t('community.catAttractions') },
    { key: 'food', label: t('community.catFood') },
    { key: 'flights', label: t('community.catFlights') },
    { key: 'entertainment', label: t('community.catEntertainment') },
    { key: 'transport', label: t('community.catTransport') },
    { key: 'synagogues', label: t('community.catSynagogues') },
    { key: 'general', label: t('community.catGeneral') },
  ];
}

function getCategoryMeta(t: (key: string) => string) {
  return {
    hotels: { label: t('community.catHotels'), color: '#6d5bd0', bg: '#f0edff' },
    attractions: { label: t('community.catAttractions'), color: '#2563eb', bg: '#eaf1ff' },
    food: { label: t('community.catFood'), color: '#15803d', bg: '#eaf7ef' },
    flights: { label: t('community.catFlights'), color: '#0369a1', bg: '#e0f2fe' },
    entertainment: { label: t('community.catEntertainment'), color: '#be185d', bg: '#fce7f3' },
    transport: { label: t('community.catTransport'), color: '#b45309', bg: '#fff4e5' },
    synagogues: { label: t('community.catSynagogues'), color: '#0f766e', bg: '#ccfbf1' },
    general: { label: t('community.catGeneral'), color: '#566173', bg: '#f2f4f7' },
  };
}

function getCategory(content: string): PostCategory {
  const normalized = content.toLowerCase();
  if (normalized.includes('מלון') || normalized.includes('hotel')) return 'hotels';
  if (normalized.includes('אטרק') || normalized.includes('טיול') || normalized.includes('attraction')) return 'attractions';
  if (normalized.includes('מסעד') || normalized.includes('אוכל') || normalized.includes('כשר') || normalized.includes('restaurant') || normalized.includes('food') || normalized.includes('kosher')) return 'food';
  if (normalized.includes('טיסה') || normalized.includes('שדה') || normalized.includes('flight') || normalized.includes('airport')) return 'flights';
  if (normalized.includes('בילוי') || normalized.includes('בר ') || normalized.includes('show') || normalized.includes('night')) return 'entertainment';
  if (normalized.includes('רכבת') || normalized.includes('מונית') || normalized.includes('מטרו') || normalized.includes('תחבורה') || normalized.includes('metro') || normalized.includes('taxi')) return 'transport';
  if (normalized.includes('מניין') || normalized.includes('מנינים') || normalized.includes('תפילה') || normalized.includes('בית כנסת') || normalized.includes('minyan') || normalized.includes('synagogue')) return 'synagogues';
  return 'general';
}

function timeAgo(iso: string, t: (key: string, opts?: any) => string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('community.justNow');
  if (minutes < 60) return t('community.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('community.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('community.daysAgo', { count: days });
}

function sortNewestFirst(items: ChatMsg[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function ChatScreen() {
  const { t, i18n } = useTranslation();
  const inputTextAlign = i18n.language === 'he' ? 'right' : 'left';
  const rtlText = i18n.language === 'he';
  const tabs = getTabs(t);
  const postCategories = getPostCategories(t);
  const categoryMeta = getCategoryMeta(t);
  const { destinationId, city } = useLocalSearchParams<{ destinationId: string; city?: string }>();
  const { user, getValidToken, isAuthenticated } = useAuth();
  const requireAuth = useRequireAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [cursors, setCursors] = useState<ReadCursor[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedCategory, setSelectedCategory] = useState<PostCategory>('general');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFullImageUrl, setSelectedFullImageUrl] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<ChatMsg | null>(null);
  const [editText, setEditText] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const inputRef = useRef<TextInput>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  const composerCategoriesScrollRef = useRef<ScrollView>(null);
  const lastTypingEmitRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const isMessageOwner = (message: ChatMsg | null | undefined) => (
    isAuthenticated
    && user?.id != null
    && message?.user.id != null
    && message.user.id === user.id
  );

  const openPost = (messageId: number) => {
    router.push({
      pathname: '/chat/post/[messageId]',
      params: {
        messageId: String(messageId),
        destinationId: String(destinationId),
        city: city ?? '',
      },
    });
  };

  useEffect(() => {
    let socket: Socket;
    let authRetried = false;
    let active = true;

    if (!isAuthenticated) {
      setLoading(true);
      client.get(`/chat/public/${destinationId}`)
        .then((response) => {
          if (active) setMessages(sortNewestFirst(response.data));
        })
        .catch(() => {
          if (active) setMessages([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

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
        setMessages(sortNewestFirst(history));
        setLoading(false);
        if (history.length > 0) {
          const newestId = Math.max(...history.map((message) => message.id));
          socket.emit('chat:mark-read', {
            destinationId: Number(destinationId),
            lastReadId: newestId,
          });
        }
      });

      socket.on('chat:newMessage', (msg: ChatMsg) => {
        setMessages((prev) => [msg, ...prev]);
        socket.emit('chat:mark-read', {
          destinationId: Number(destinationId),
          lastReadId: msg.id,
        });
      });

      socket.on('chat:newComment', ({ parentMessageId, comment }: { parentMessageId: number; comment: ChatMsg }) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === parentMessageId
              ? { ...message, comments: [...(message.comments ?? []), comment] }
              : message,
          ),
        );
      });

      socket.on(
        'chat:likesUpdated',
        (payload: { messageId: number; likeCount: number; likedByMe: boolean; likedBy: ChatUser[] }) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === payload.messageId
                ? {
                    ...message,
                    likeCount: payload.likeCount,
                    likedByMe: payload.likedBy.some((likeUser) => likeUser.id === user?.id),
                    likedBy: payload.likedBy,
                  }
                : message,
            ),
          );
        },
      );

      socket.on('chat:postUpdated', ({ message }: { message: ChatMsg }) => {
        setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, ...message } : item)));
      });

      socket.on('chat:postDeleted', ({ messageId }: { messageId: number }) => {
        setMessages((prev) => prev.filter((message) => message.id !== messageId));
        setEditingPost((current) => (current?.id === messageId ? null : current));
      });

      socket.on(
        'chat:commentUpdated',
        ({ parentMessageId, comment }: { parentMessageId: number; comment: ChatMsg }) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === parentMessageId
                ? {
                    ...message,
                    comments: (message.comments ?? []).map((item) =>
                      item.id === comment.id ? { ...item, ...comment } : item,
                    ),
                  }
                : message,
            ),
          );
        },
      );

      socket.on(
        'chat:commentDeleted',
        ({ parentMessageId, commentId }: { parentMessageId: number; commentId: number }) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === parentMessageId
                ? {
                    ...message,
                    comments: (message.comments ?? []).filter((comment) => comment.id !== commentId),
                  }
                : message,
            ),
          );
        },
      );

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
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
          delete typingTimeoutsRef.current[userId];
        }, 4000);
      });

      socket.on('chat:stop-typing', ({ userId }: { userId: number }) => {
        if (typingTimeoutsRef.current[userId]) clearTimeout(typingTimeoutsRef.current[userId]);
        delete typingTimeoutsRef.current[userId];
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
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
        console.warn('Chat connection error:', err.message);
        setLoading(false);
      });
    };

    void connect();

    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { destinationId: Number(destinationId) });
        socketRef.current.disconnect();
      }
    };
  }, [destinationId, getValidToken, isAuthenticated, user?.id]);

  const visibleMessages = useMemo(() => {
    if (activeTab === 'all') return messages;
    return messages.filter((message) => (message.category ?? getCategory(message.content)) === activeTab);
  }, [activeTab, messages]);

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

  const uploadSelectedImage = async () => {
    if (!selectedImage) return null;
    const token = await getValidToken();
    if (!token) throw new Error('Missing auth token');

    const formData = new FormData();
    formData.append('file', {
      uri: selectedImage.uri,
      type: selectedImage.mimeType ?? 'image/jpeg',
      name: 'community-post.jpg',
    } as any);

    const response = await fetch(`${API_URL}/chat/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`Image upload failed (${response.status})`);
    const payload = await response.json();
    return String(payload.imageUrl);
  };

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert(t('community.tooLongTitle'), t('community.tooLongSendMsg'));
      return;
    }
    let imageUrl: string | null = null;
    if (selectedImage) {
      try {
        setUploadingImage(true);
        imageUrl = await uploadSelectedImage();
      } catch {
        Alert.alert(t('common.error'), t('community.imageUploadFailedMsg'));
        setUploadingImage(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    }
    socketRef.current.emit('chat:sendMessage', {
      destinationId: Number(destinationId),
      content,
      category: selectedCategory,
      imageUrl,
    });
    socketRef.current.emit('chat:stop-typing', { destinationId: Number(destinationId) });
    lastTypingEmitRef.current = 0;
    setText('');
    setSelectedCategory('general');
    setSelectedImage(null);
    setComposerOpen(false);
  };

  const reportMessage = (messageId: number) => {
    requireAuth(() => {
      Alert.alert(t('community.reportPostTitle'), t('community.reportPostMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('community.reportBtn'),
          style: 'destructive',
          onPress: () => {
            socketRef.current?.emit('chat:report', { messageId });
            Alert.alert(t('community.reportSentTitle'), t('community.reportSentMsg'));
          },
        },
      ]);
    }, { reason: 'community' });
  };

  const toggleLike = (messageId: number) => {
    requireAuth(() => {
      socketRef.current?.emit('chat:toggleLike', { destinationId: Number(destinationId), messageId });
    }, { reason: 'community' });
  };

  const showLikedBy = (message: ChatMsg) => {
    requireAuth(() => {
      const likedBy = message.likedBy ?? [];
      if (likedBy.length === 0) return;
      Alert.alert(
        t('community.likesTitle'),
        likedBy.map((likeUser) => `${likeUser.firstName} ${likeUser.lastName}`).join('\n'),
        [{ text: t('community.closeBtn') }],
      );
    }, { reason: 'community' });
  };

  const openPostMenu = (message: ChatMsg) => {
    if (!isMessageOwner(message)) return;
    Alert.alert(t('community.postOptionsTitle'), undefined, [
      {
        text: t('community.editBtn'),
        onPress: () => {
          setEditingPost(message);
          setEditText(message.content);
        },
      },
      {
        text: t('community.deleteBtn'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('community.deletePostTitle'), t('community.deletePostMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('community.confirmDeleteBtn'),
              style: 'destructive',
              onPress: () => {
                socketRef.current?.emit('chat:deletePost', {
                  destinationId: Number(destinationId),
                  messageId: message.id,
                });
              },
            },
          ]);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const submitEdit = () => {
    const content = editText.trim();
    if (!isMessageOwner(editingPost) || !editingPost || !content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert(t('community.tooLongTitle'), t('community.tooLongEditMsg'));
      return;
    }
    socketRef.current.emit('chat:updatePost', {
      destinationId: Number(destinationId),
      messageId: editingPost.id,
      content,
    });
    setEditingPost(null);
    setEditText('');
  };

  const openComposer = () => {
    requireAuth(() => setComposerOpen((current) => !current), { reason: 'community' });
  };

  const cancelComposer = () => {
    setComposerOpen(false);
    setText('');
    setSelectedCategory('general');
    setSelectedImage(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('community.permissionNeededTitle'), t('community.permissionNeededMsg'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    setSelectedImage(asset ? { uri: asset.uri, mimeType: asset.mimeType } : null);
  };

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const isMe = isMessageOwner(item);
    const initials = `${item.user.firstName?.[0] ?? ''}${item.user.lastName?.[0] ?? ''}`.toUpperCase();
    const category = item.category ?? getCategory(item.content);
    const meta = categoryMeta[category];
    const comments = item.comments ?? [];
    const likeCount = item.likeCount ?? 0;
    const commentsLabel = comments.length > 0 ? t('community.commentsLabel', { count: comments.length }) : t('community.commentsLabelZero');

    return (
      <Pressable
        style={styles.postCard}
        onPress={() => openPost(item.id)}
        onLongPress={() => !isMe && reportMessage(item.id)}
        delayLongPress={500}
      >
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>

          <View style={styles.authorBlock}>
            <View style={styles.nameLine}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.user.firstName} {item.user.lastName}
              </Text>
              <View style={[styles.categoryChip, { backgroundColor: meta.bg }]}>
                <Text style={[styles.categoryText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {isMe && <Text style={styles.mineLabel}>{t('community.mineLabel')}</Text>}
            </View>
            <Text style={styles.postTime}>{timeAgo(item.createdAt, t)}</Text>
          </View>

          {isMe && (
            <Pressable
              style={styles.postMenuBtn}
              onPress={(event) => {
                event.stopPropagation();
                openPostMenu(item);
              }}
            >
              <MoreVertical size={17} color="#98A2B3" strokeWidth={2.5} />
            </Pressable>
          )}
        </View>

        <Text style={styles.postText}>{item.content}</Text>
        {item.imageUrl && (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setSelectedFullImageUrl(item.imageUrl ?? null);
            }}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} contentFit="cover" />
          </Pressable>
        )}

        <View style={styles.postActions}>
          <Pressable
            style={[styles.actionPill, styles.likePill, item.likedByMe && styles.actionPillActive]}
            onPress={(event) => {
              event.stopPropagation();
              toggleLike(item.id);
            }}
            onLongPress={() => showLikedBy(item)}
          >
            <Text style={[styles.actionText, item.likedByMe && styles.actionTextActive]}>{likeCount}</Text>
            <Text style={styles.actionEmoji}>👍</Text>
          </Pressable>

          <Pressable
            style={[styles.actionPill, styles.commentPill]}
            onPress={(event) => {
              event.stopPropagation();
              openPost(item.id);
            }}
          >
            <Text style={styles.actionText}>{commentsLabel}</Text>
            <Text style={styles.commentBubble}>●</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderFeedHeader = () => (
    <View style={styles.feedHeader}>
      <View style={styles.askWrap}>
        <Pressable style={styles.askButton} onPress={openComposer}>
          <Plus size={19} color="#fff" strokeWidth={2.7} />
          <Text style={styles.askText}>{t('community.askQuestionPrompt')}</Text>
        </Pressable>
      </View>

      {composerOpen && (
        <View style={styles.inlineComposerCard}>
          <TextInput
            ref={inputRef}
            style={styles.inlineQuestionInput}
            value={text}
            onChangeText={setText}
            placeholder={t('community.composerPlaceholder')}
            placeholderTextColor="#8D8D8D"
            multiline
            maxLength={500}
            textAlign={inputTextAlign}
          />

          <ScrollView
            ref={composerCategoriesScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inlineCategoryRow}
            onContentSizeChange={() => composerCategoriesScrollRef.current?.scrollToEnd({ animated: false })}
          >
            {postCategories.map((category) => {
              const selected = selectedCategory === category.key;
              return (
                <Pressable
                  key={category.key}
                  style={[styles.inlineCategoryPill, selected && styles.inlineCategoryPillSelected]}
                  onPress={() => setSelectedCategory(category.key)}
                >
                  <Text style={[styles.inlineCategoryText, selected && styles.inlineCategoryTextSelected]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.inlineAttachBox} onPress={pickImage}>
            <ImageIcon size={17} color="#6B7280" strokeWidth={2.2} />
            <Text style={styles.inlineAttachText}>
              {selectedImage ? t('community.changeImageBtn') : t('community.attachImageBtn')}
            </Text>
          </Pressable>

          {selectedImage && (
            <View style={styles.inlineImagePreviewWrap}>
              <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} contentFit="cover" />
              <Pressable style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
                <X size={16} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>
          )}

          <View style={styles.inlineComposerActions}>
            <Pressable style={styles.inlineCancelBtn} onPress={cancelComposer}>
              <Text style={styles.inlineCancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.inlinePublishBtn, (!text.trim() || !connected || uploadingImage) && styles.inlinePublishBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!text.trim() || !connected || uploadingImage}
            >
              <Text style={styles.inlinePublishText}>{uploadingImage ? t('community.uploadingBtn') : t('community.publishBtn')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        ref={tabsScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsScroll}
        onContentSizeChange={() => tabsScrollRef.current?.scrollToEnd({ animated: false })}
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const title = city ? t('community.communityOfCity', { city }) : t('community.communityOfDestination');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={21} color={C.navy} strokeWidth={2.4} />
          </Pressable>

          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.liveDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
              <Text style={styles.statusText}>
                {!isAuthenticated
                  ? t('community.guestReadOnlyStatus')
                  : connected
                    ? t('community.activePostsStatus', { count: messages.length })
                    : t('community.connectingStatus')}
              </Text>
            </View>
          </View>

          <View style={styles.iconSpacer} />
        </View>

      </View>

      {!isAuthenticated && (
        <Pressable
          style={styles.readOnlyBanner}
          onPress={() => requireAuth(() => {}, { reason: 'community' })}
        >
          <Text style={styles.readOnlyText}>{t('community.guestReadOnlyBanner')}</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.hostingBanner, rtlText && styles.hostingBannerRtl]}
        onPress={() => requireAuth(
          () => router.push(`/hosting/${destinationId}${city ? `?city=${city}` : ''}` as any),
          { reason: 'hosting' },
        )}
      >
        <Text style={styles.hostingBannerIcon}>🏠</Text>
        <Text style={[styles.hostingBannerText, rtlText && styles.rtlText]}>{t('community.hostingBannerText')}</Text>
        <ChevronLeft
          size={18}
          color="#DB2777"
          strokeWidth={2.4}
          style={!rtlText ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderFeedHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MessageCircle size={44} color="#D7DCE5" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>{t('community.emptyPostsTitle')}</Text>
              <Text style={styles.emptyText}>{t('community.emptyPostsSub')}</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      <Modal visible={!!editingPost} animationType="fade" transparent onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView
          style={styles.editModalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalScrim} onPress={() => setEditingPost(null)} />
          <View style={styles.editSheet}>
            <View style={styles.composerHeader}>
              <Pressable style={styles.closeBtn} onPress={() => setEditingPost(null)}>
                <X size={22} color="#7C8796" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.composerTitle}>{t('community.editPostTitle')}</Text>
            </View>
            <TextInput
              style={styles.questionInput}
              value={editText}
              onChangeText={setEditText}
              placeholder={t('community.editPlaceholder')}
              placeholderTextColor="#8D8D8D"
              multiline
              maxLength={500}
              textAlign={inputTextAlign}
              autoFocus
            />
            <Pressable
              style={[styles.publishBtn, (!editText.trim() || !connected) && styles.publishBtnDisabled]}
              onPress={submitEdit}
              disabled={!editText.trim() || !connected}
            >
              <Text style={styles.publishText}>{t('community.saveChangesBtn')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selectedFullImageUrl} animationType="fade" transparent onRequestClose={() => setSelectedFullImageUrl(null)}>
        <View style={styles.fullImageBackdrop}>
          <Pressable style={styles.fullImageCloseBtn} onPress={() => setSelectedFullImageUrl(null)}>
            <X size={24} color="#fff" strokeWidth={2.6} />
          </Pressable>
          {selectedFullImageUrl && (
            <Image source={{ uri: selectedFullImageUrl }} style={styles.fullImage} contentFit="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F1E8',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyBanner: {
    backgroundColor: '#EEF4FF',
    borderBottomWidth: 1,
    borderBottomColor: '#D7E4FA',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  readOnlyText: {
    color: C.navy,
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFDF8',
    borderBottomWidth: 1,
    borderBottomColor: '#E9DEC9',
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#EFE4CF',
    borderRadius: 21,
    borderWidth: 1,
    elevation: 2,
    height: 42,
    justifyContent: 'center',
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    width: 42,
  },
  iconSpacer: {
    height: 42,
    width: 42,
  },
  hostingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FDF2F8',
    borderBottomWidth: 1,
    borderBottomColor: '#FBCFE8',
  },
  hostingBannerRtl: {
    flexDirection: 'row-reverse',
  },
  hostingBannerIcon: {
    fontSize: 16,
  },
  hostingBannerText: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#DB2777',
    textAlign: 'auto',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerTitleBlock: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 21,
    textAlign: 'auto',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 3,
  },
  liveDot: {
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  statusText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  feedHeader: {
    marginBottom: 2,
  },
  tabsScroll: {
    marginTop: 12,
  },
  tabsContent: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#EADFCA',
    borderWidth: 1,
    borderRadius: 19,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 13,
  },
  tabSelected: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  tabText: {
    color: '#596476',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 13,
  },
  tabTextSelected: {
    color: '#fff',
  },
  askWrap: {
    paddingTop: 0,
  },
  askButton: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 15,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  askText: {
    color: '#fff',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 15,
  },
  feed: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  inlineComposerCard: {
    backgroundColor: '#fff',
    borderColor: '#F0E6D6',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    marginTop: 10,
    padding: 12,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  inlineQuestionInput: {
    backgroundColor: '#FFFDF8',
    borderColor: '#EFE3CF',
    borderRadius: 15,
    borderWidth: 1,
    color: C.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 92,
    paddingHorizontal: 13,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inlineCategoryRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 11,
  },
  inlineCategoryPill: {
    alignItems: 'center',
    backgroundColor: '#F3F5FA',
    borderColor: '#F3F5FA',
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 13,
  },
  inlineCategoryPillSelected: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  inlineCategoryText: {
    color: '#747C8C',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 12.5,
  },
  inlineCategoryTextSelected: {
    color: '#fff',
  },
  inlineAttachBox: {
    alignItems: 'center',
    borderColor: '#E6D9C2',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  inlineAttachText: {
    color: '#747C8C',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 13,
  },
  inlineImagePreviewWrap: {
    borderRadius: 14,
    height: 112,
    marginTop: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  inlineComposerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  inlineCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  inlineCancelText: {
    color: '#6B7280',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 13,
  },
  inlinePublishBtn: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 88,
    paddingHorizontal: 16,
  },
  inlinePublishBtnDisabled: {
    backgroundColor: '#C8CEDA',
  },
  inlinePublishText: {
    color: '#fff',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 13,
  },
  postCard: {
    backgroundColor: '#fff',
    borderColor: '#F3EBDD',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
  },
  postHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EAF8EF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: {
    color: '#128347',
    fontFamily: 'Inter-Black',
    fontSize: 12,
  },
  authorBlock: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  authorName: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 13.5,
    maxWidth: 118,
    textAlign: 'auto',
  },
  mineLabel: {
    backgroundColor: '#FFF7DD',
    borderRadius: 8,
    color: '#8A6E28',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 9.5,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  postTime: {
    color: '#B8C0CC',
    fontFamily: 'Inter-Regular',
    fontSize: 10.5,
    marginTop: 2,
  },
  categoryChip: {
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 11,
  },
  postMenuBtn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  postText: {
    color: '#172033',
    fontFamily: 'Inter-Regular',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 10,
    textAlign: 'auto',
  },
  postImage: {
    borderRadius: 14,
    height: 148,
    marginTop: 12,
    overflow: 'hidden',
    width: '100%',
  },
  postActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: '#F8F6FC',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 11,
  },
  likePill: {
    backgroundColor: '#F7F4FA',
  },
  commentPill: {
    backgroundColor: '#F5F3FF',
  },
  actionPillActive: {
    backgroundColor: C.goldFaint,
  },
  actionText: {
    color: '#687386',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 12.5,
  },
  actionTextActive: {
    color: '#9b7a24',
  },
  actionEmoji: {
    fontSize: 13,
  },
  commentBubble: {
    color: '#B8B4F6',
    fontSize: 12,
    lineHeight: 13,
  },
  commentsBox: {
    backgroundColor: '#F8F4ED',
    borderColor: '#EFE5D4',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 13,
    padding: 11,
  },
  commentsTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'auto',
  },
  noCommentsText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: 9,
    textAlign: 'auto',
  },
  commentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    padding: 9,
  },
  commentHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentAuthor: {
    color: C.navy,
    flex: 1,
    fontFamily: 'Inter-ExtraBold',
    fontSize: 12,
    textAlign: 'auto',
  },
  commentMenuBtn: {
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  commentText: {
    color: '#3D4757',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
    textAlign: 'auto',
  },
  commentTime: {
    color: '#A3ACB8',
    fontFamily: 'Inter-Regular',
    fontSize: 10.5,
    marginTop: 3,
    textAlign: 'auto',
  },
  commentInputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  commentInput: {
    backgroundColor: '#fff',
    borderColor: '#EFE3CF',
    borderRadius: 13,
    borderWidth: 1,
    color: C.textPrimary,
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    maxHeight: 82,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 9,
    textAlignVertical: 'top',
  },
  commentSendBtn: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 13,
  },
  commentSendBtnDisabled: {
    backgroundColor: '#C8CEDA',
  },
  commentSendText: {
    color: '#fff',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingTop: 86,
  },
  emptyTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 17,
  },
  emptyText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  typingBar: {
    backgroundColor: '#fff',
    borderTopColor: 'rgba(11,23,54,0.05)',
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 5,
  },
  typingText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'auto',
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopColor: 'rgba(11,23,54,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  input: {
    backgroundColor: '#F8F4EA',
    borderColor: '#E9DEC9',
    borderRadius: 21,
    borderWidth: 1,
    color: C.textPrimary,
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    maxHeight: 98,
    minHeight: 42,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sendBtn: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,23,54,0.28)',
  },
  composerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  editModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  editSheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 20,
  },
  composerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  closeBtn: {
    alignItems: 'center',
    backgroundColor: '#F3F6FA',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  composerTitle: {
    color: C.navy,
    flex: 1,
    fontFamily: 'Inter-Black',
    fontSize: 23,
    textAlign: 'auto',
  },
  fieldLabel: {
    color: '#1B2538',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'auto',
  },
  categorySelector: {
    flexWrap: 'wrap',
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 20,
  },
  categoryOption: {
    alignItems: 'center',
    backgroundColor: '#F3F5FA',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 49,
    width: '22.6%',
  },
  categoryOptionSelected: {
    backgroundColor: C.navy,
  },
  categoryOptionText: {
    color: '#747C8C',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 14,
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  questionInput: {
    backgroundColor: '#fff',
    borderColor: '#EFE3CF',
    borderRadius: 16,
    borderWidth: 1,
    color: C.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 23,
    minHeight: 112,
    paddingHorizontal: 15,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  attachBox: {
    alignItems: 'center',
    borderColor: '#E6D9C2',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 72,
  },
  attachText: {
    color: '#747C8C',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 15,
  },
  imagePreviewWrap: {
    borderRadius: 16,
    height: 132,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    height: '100%',
    width: '100%',
  },
  removeImageBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(11,23,54,0.72)',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    left: 10,
    position: 'absolute',
    top: 10,
    width: 30,
  },
  publishBtn: {
    alignItems: 'center',
    backgroundColor: '#384CF4',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 64,
  },
  publishBtnDisabled: {
    backgroundColor: '#B9C0D4',
  },
  publishText: {
    color: '#fff',
    fontFamily: 'Inter-Black',
    fontSize: 18,
  },
  detailScreen: {
    flex: 1,
    backgroundColor: '#F6F1E8',
    paddingTop: Platform.OS === 'ios' ? 58 : 34,
  },
  detailHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderBottomColor: '#E9DEC9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 13,
    paddingHorizontal: 18,
  },
  detailTitle: {
    color: C.navy,
    flex: 1,
    fontFamily: 'Inter-Black',
    fontSize: 22,
    textAlign: 'auto',
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    padding: 18,
    paddingBottom: 18,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderColor: '#F0E6D6',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    padding: 15,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  detailPostImage: {
    borderRadius: 16,
    height: 210,
    marginTop: 13,
    overflow: 'hidden',
    width: '100%',
  },
  detailCommentsBox: {
    backgroundColor: '#fff',
    borderColor: '#F0E6D6',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 13,
  },
  detailCommentsTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 16,
    marginBottom: 11,
    textAlign: 'auto',
  },
  detailEmptyComments: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 118,
    paddingVertical: 18,
  },
  detailEmptyCommentsText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  detailStickyInput: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFDF8',
    borderTopColor: '#E9DEC9',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  detailCommentInput: {
    backgroundColor: '#fff',
    borderColor: '#EFE3CF',
    borderRadius: 15,
    borderWidth: 1,
    color: C.textPrimary,
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    maxHeight: 92,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  fullImageBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.94)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fullImage: {
    height: '100%',
    width: '100%',
  },
  fullImageCloseBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 34,
    width: 44,
    zIndex: 2,
  },
});
