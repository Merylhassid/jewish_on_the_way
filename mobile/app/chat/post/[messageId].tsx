import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ArrowLeft, MessageCircle, MoreVertical, X } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

import { C } from '@/constants/theme';
import client, { API_URL } from '@/src/api/client';
import { useAuth } from '@/src/store/auth';
import { useRequireAuth } from '@/src/auth/auth-gates';

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

type PostCategory =
  | 'hotels'
  | 'attractions'
  | 'food'
  | 'flights'
  | 'entertainment'
  | 'transport'
  | 'synagogues'
  | 'general';

const categoryMeta = {
  hotels: { label: 'מלונות', color: '#6d5bd0', bg: '#f0edff' },
  attractions: { label: 'אטרקציות', color: '#2563eb', bg: '#eaf1ff' },
  food: { label: 'אוכל', color: '#15803d', bg: '#eaf7ef' },
  flights: { label: 'טיסות', color: '#0369a1', bg: '#e0f2fe' },
  entertainment: { label: 'בילויים', color: '#be185d', bg: '#fce7f3' },
  transport: { label: 'תחבורה', color: '#b45309', bg: '#fff4e5' },
  synagogues: { label: 'בתי כנסת', color: '#0f766e', bg: '#ccfbf1' },
  general: { label: 'כללי', color: '#566173', bg: '#f2f4f7' },
};

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

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function CommunityPostScreen() {
  const { t } = useTranslation();
  const { messageId, destinationId, city } = useLocalSearchParams<{
    messageId: string;
    destinationId: string;
    city?: string;
  }>();
  const { user, getValidToken, isAuthenticated } = useAuth();
  const requireAuth = useRequireAuth();
  const postId = Number(messageId);
  const destId = Number(destinationId);
  const [post, setPost] = useState<ChatMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [editingPost, setEditingPost] = useState<ChatMsg | null>(null);
  const [editText, setEditText] = useState('');
  const [editingComment, setEditingComment] = useState<ChatMsg | null>(null);
  const [commentEditText, setCommentEditText] = useState('');
  const [selectedFullImageUrl, setSelectedFullImageUrl] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const isMessageOwner = (message: ChatMsg | null | undefined) => (
    isAuthenticated
    && user?.id != null
    && message?.user.id != null
    && message.user.id === user.id
  );

  useEffect(() => {
    let socket: Socket | null = null;
    let authRetried = false;
    let active = true;

    if (!isAuthenticated) {
      setLoading(true);
      client.get(`/chat/public/${destId}/posts/${postId}`)
        .then((response) => {
          if (active) setPost(response.data);
        })
        .catch(() => {
          if (active) setPost(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

    const connect = async () => {
      const token = await getValidToken();
      if (!token) {
        setLoading(false);
        return;
      }

      socket = io(`${API_URL}/chat`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket?.emit('chat:join', { destinationId: destId });
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('chat:history', (history: ChatMsg[]) => {
        setPost(history.find((message) => message.id === postId) ?? null);
        setLoading(false);
      });

      socket.on('chat:newComment', ({ parentMessageId, comment }: { parentMessageId: number; comment: ChatMsg }) => {
        if (parentMessageId !== postId) return;
        setPost((current) =>
          current ? { ...current, comments: [...(current.comments ?? []), comment] } : current,
        );
      });

      socket.on(
        'chat:likesUpdated',
        (payload: { messageId: number; likeCount: number; likedByMe: boolean; likedBy: ChatUser[] }) => {
          if (payload.messageId !== postId) return;
          setPost((current) =>
            current
              ? {
                  ...current,
                  likeCount: payload.likeCount,
                  likedByMe: payload.likedBy.some((likeUser) => likeUser.id === user?.id),
                  likedBy: payload.likedBy,
                }
              : current,
          );
        },
      );

      socket.on('chat:postUpdated', ({ message }: { message: ChatMsg }) => {
        if (message.id !== postId) return;
        setPost((current) => (current ? { ...current, ...message } : message));
      });

      socket.on('chat:postDeleted', ({ messageId: deletedId }: { messageId: number }) => {
        if (deletedId === postId) router.back();
      });

      socket.on(
        'chat:commentUpdated',
        ({ parentMessageId, comment }: { parentMessageId: number; comment: ChatMsg }) => {
          if (parentMessageId !== postId) return;
          setPost((current) =>
            current
              ? {
                  ...current,
                  comments: (current.comments ?? []).map((item) =>
                    item.id === comment.id ? { ...item, ...comment } : item,
                  ),
                }
              : current,
          );
        },
      );

      socket.on(
        'chat:commentDeleted',
        ({ parentMessageId, commentId }: { parentMessageId: number; commentId: number }) => {
          if (parentMessageId !== postId) return;
          setPost((current) =>
            current
              ? { ...current, comments: (current.comments ?? []).filter((comment) => comment.id !== commentId) }
              : current,
          );
          setEditingComment((current) => (current?.id === commentId ? null : current));
        },
      );

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
          if (freshToken && socket) {
            socket.auth = { token: freshToken };
            socket.disconnect();
            socket.connect();
            return;
          }
        }
        console.warn('Post chat connection error:', err.message);
        setLoading(false);
      });
    };

    void connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('chat:leave', { destinationId: destId });
        socketRef.current.disconnect();
      }
    };
  }, [destId, getValidToken, isAuthenticated, postId, user?.id]);

  const category = useMemo(() => {
    if (!post) return 'general';
    return post.category ?? getCategory(post.content);
  }, [post]);

  const meta = categoryMeta[category];
  const comments = post?.comments ?? [];
  const initials = post
    ? `${post.user.firstName?.[0] ?? ''}${post.user.lastName?.[0] ?? ''}`.toUpperCase()
    : '';

  const toggleLike = () => {
    if (!post) return;
    requireAuth(() => {
      socketRef.current?.emit('chat:toggleLike', { destinationId: destId, messageId: post.id });
    }, { reason: 'community' });
  };

  const showLikedBy = () => {
    requireAuth(() => {
      const likedBy = post?.likedBy ?? [];
      if (likedBy.length === 0) return;
      Alert.alert(
        'לייקים',
        likedBy.map((likeUser) => `${likeUser.firstName} ${likeUser.lastName}`).join('\n'),
        [{ text: 'סגור' }],
      );
    }, { reason: 'community' });
  };

  const sendComment = () => {
    requireAuth(() => {
      if (!post || !commentDraft.trim() || !socketRef.current?.connected) return;
      const content = commentDraft.trim();
      if (content.length > 500) {
        Alert.alert('ארוך מדי', 'אפשר לשלוח עד 500 תווים.');
        return;
      }
      socketRef.current.emit('chat:sendMessage', {
        destinationId: destId,
        content,
        category,
        parentMessageId: post.id,
      });
      setCommentDraft('');
    }, { reason: 'community' });
  };

  const submitEdit = () => {
    const content = editText.trim();
    if (!isMessageOwner(editingPost) || !editingPost || !content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert('ארוך מדי', 'אפשר לערוך עד 500 תווים.');
      return;
    }
    socketRef.current.emit('chat:updatePost', {
      destinationId: destId,
      messageId: editingPost.id,
      content,
    });
    setEditingPost(null);
    setEditText('');
  };

  const submitCommentEdit = () => {
    const content = commentEditText.trim();
    if (!isMessageOwner(editingComment) || !editingComment || !content || !socketRef.current?.connected) return;
    if (content.length > 500) {
      Alert.alert('ארוך מדי', 'אפשר לערוך עד 500 תווים.');
      return;
    }
    socketRef.current.emit('chat:updateComment', {
      destinationId: destId,
      commentId: editingComment.id,
      content,
    });
    setEditingComment(null);
    setCommentEditText('');
  };

  const openPostMenu = () => {
    if (!isMessageOwner(post) || !post) return;
    Alert.alert('אפשרויות פוסט', undefined, [
      {
        text: 'עריכה',
        onPress: () => {
          setEditingPost(post);
          setEditText(post.content);
        },
      },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: () => {
          Alert.alert('מחיקת פוסט', 'למחוק את הפוסט ואת כל התגובות שלו?', [
            { text: 'ביטול', style: 'cancel' },
            {
              text: 'מחק',
              style: 'destructive',
              onPress: () => {
                socketRef.current?.emit('chat:deletePost', {
                  destinationId: destId,
                  messageId: post.id,
                });
              },
            },
          ]);
        },
      },
      { text: 'ביטול', style: 'cancel' },
    ]);
  };

  const openCommentMenu = (comment: ChatMsg) => {
    if (!isMessageOwner(comment)) return;
    Alert.alert('אפשרויות תגובה', undefined, [
      {
        text: 'עריכה',
        onPress: () => {
          setEditingComment(comment);
          setCommentEditText(comment.content);
        },
      },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: () => {
          Alert.alert('מחיקת תגובה', 'למחוק את התגובה?', [
            { text: 'ביטול', style: 'cancel' },
            {
              text: 'מחק',
              style: 'destructive',
              onPress: () => {
                socketRef.current?.emit('chat:deleteComment', {
                  destinationId: destId,
                  commentId: comment.id,
                });
              },
            },
          ]);
        },
      },
      { text: 'ביטול', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={21} color={C.navy} strokeWidth={2.4} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>פוסט בקהילה</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {!isAuthenticated
              ? t('community.guestReadOnlyStatus')
              : city
                ? `קהילת ${city}`
                : connected
                  ? 'מחובר לקהילה'
                  : 'מתחבר…'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : !post ? (
        <View style={styles.center}>
          <MessageCircle size={42} color="#D7DCE5" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>הפוסט לא נמצא</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>חזרה לקהילה</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || '?'}</Text>
                </View>

                <View style={styles.authorBlock}>
                  <View style={styles.nameLine}>
                    <Text style={styles.authorName} numberOfLines={1}>
                      {post.user.firstName} {post.user.lastName}
                    </Text>
                    <View style={[styles.categoryChip, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.categoryText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {isMessageOwner(post) && <Text style={styles.mineLabel}>שלי</Text>}
                  </View>
                  <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
                </View>

                {isMessageOwner(post) && (
                  <Pressable style={styles.postMenuBtn} onPress={openPostMenu}>
                    <MoreVertical size={17} color="#98A2B3" strokeWidth={2.5} />
                  </Pressable>
                )}
              </View>

              <Text style={styles.postText}>{post.content}</Text>
              {post.imageUrl && (
                <Pressable onPress={() => setSelectedFullImageUrl(post.imageUrl ?? null)}>
                  <Image source={{ uri: post.imageUrl }} style={styles.postImage} contentFit="cover" />
                </Pressable>
              )}

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionPill, styles.likePill, post.likedByMe && styles.actionPillActive]}
                  onPress={toggleLike}
                  onLongPress={showLikedBy}
                >
                  <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>
                    {post.likeCount ?? 0}
                  </Text>
                  <Text style={styles.actionEmoji}>👍</Text>
                </Pressable>

                <View style={[styles.actionPill, styles.commentPill]}>
                  <Text style={styles.actionText}>
                    {comments.length > 0 ? `${comments.length} תגובות` : 'תגובות'}
                  </Text>
                  <Text style={styles.commentBubble}>●</Text>
                </View>
              </View>
            </View>

            <View style={styles.commentsBox}>
              <Text style={styles.commentsTitle}>תגובות ({comments.length})</Text>
              {comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <MessageCircle size={28} color="#D7DCE5" strokeWidth={1.5} />
                  <Text style={styles.emptyCommentsText}>אין עדיין תגובות. היו הראשונים להגיב!</Text>
                </View>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>
                        {comment.user.firstName} {comment.user.lastName}
                      </Text>
                      {isMessageOwner(comment) && (
                        <Pressable style={styles.commentMenuBtn} onPress={() => openCommentMenu(comment)}>
                          <MoreVertical size={15} color="#7C8796" strokeWidth={2.4} />
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                    <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {isAuthenticated ? (
            <View style={styles.stickyInput}>
              <TextInput
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="כתוב תגובה לפוסט הזה…"
                placeholderTextColor="#9AA3B1"
                multiline
                maxLength={500}
                textAlign="right"
              />
              <Pressable
                style={[styles.commentSendBtn, (!commentDraft.trim() || !connected) && styles.commentSendBtnDisabled]}
                onPress={sendComment}
                disabled={!commentDraft.trim() || !connected}
              >
                <Text style={styles.commentSendText}>שלח</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.guestReplyButton}
              onPress={() => requireAuth(() => {}, { reason: 'community' })}
            >
              <Text style={styles.guestReplyText}>{t('community.guestReplyPrompt')}</Text>
            </Pressable>
          )}
        </>
      )}

      <Modal visible={!!editingPost} animationType="fade" transparent onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView style={styles.editModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalScrim} onPress={() => setEditingPost(null)} />
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Pressable style={styles.closeBtn} onPress={() => setEditingPost(null)}>
                <X size={22} color="#7C8796" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.editTitle}>עריכת פוסט</Text>
            </View>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="מה תרצה לעדכן?"
              placeholderTextColor="#8D8D8D"
              multiline
              maxLength={500}
              textAlign="right"
              autoFocus
            />
            <Pressable
              style={[styles.saveBtn, (!editText.trim() || !connected) && styles.saveBtnDisabled]}
              onPress={submitEdit}
              disabled={!editText.trim() || !connected}
            >
              <Text style={styles.saveText}>שמור שינויים</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!editingComment} animationType="fade" transparent onRequestClose={() => setEditingComment(null)}>
        <KeyboardAvoidingView style={styles.editModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalScrim} onPress={() => setEditingComment(null)} />
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Pressable style={styles.closeBtn} onPress={() => setEditingComment(null)}>
                <X size={22} color="#7C8796" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.editTitle}>עריכת תגובה</Text>
            </View>
            <TextInput
              style={styles.editInput}
              value={commentEditText}
              onChangeText={setCommentEditText}
              placeholder="מה תרצה לעדכן?"
              placeholderTextColor="#8D8D8D"
              multiline
              maxLength={500}
              textAlign="right"
              autoFocus
            />
            <Pressable
              style={[styles.saveBtn, (!commentEditText.trim() || !connected) && styles.saveBtnDisabled]}
              onPress={submitCommentEdit}
              disabled={!commentEditText.trim() || !connected}
            >
              <Text style={styles.saveText}>שמור תגובה</Text>
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

export default CommunityPostScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F1E8',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  guestReplyButton: {
    backgroundColor: C.navy,
    margin: 14,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  guestReplyText: {
    color: '#fff',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderBottomColor: '#E9DEC9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 13,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 58 : 36,
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
  titleBlock: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 22,
    textAlign: 'right',
  },
  subtitle: {
    color: '#7C8796',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 18,
  },
  postCard: {
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
  postHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E8F8EE',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: '#0F7A3B',
    fontFamily: 'Inter-Black',
    fontSize: 13,
  },
  authorBlock: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  authorName: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 13,
    maxWidth: 135,
    textAlign: 'right',
  },
  categoryChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 10.5,
  },
  mineLabel: {
    backgroundColor: '#FFF5D9',
    borderRadius: 8,
    color: '#8A6E28',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  postTime: {
    color: '#A0A8B5',
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  postMenuBtn: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    marginTop: -3,
    width: 30,
  },
  postText: {
    color: C.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 13,
    textAlign: 'right',
  },
  postImage: {
    borderRadius: 16,
    height: 210,
    marginTop: 13,
    overflow: 'hidden',
    width: '100%',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    marginTop: 14,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: '#F7F8FB',
    borderRadius: 17,
    flexDirection: 'row-reverse',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 13,
  },
  actionPillActive: {
    backgroundColor: '#EEF2FF',
  },
  likePill: {},
  commentPill: {},
  actionText: {
    color: '#647083',
    fontFamily: 'Inter-ExtraBold',
    fontSize: 13,
  },
  actionTextActive: {
    color: '#384CF4',
  },
  actionEmoji: {
    fontSize: 14,
  },
  commentBubble: {
    color: '#A99CFF',
    fontSize: 13,
  },
  commentsBox: {
    backgroundColor: '#fff',
    borderColor: '#F0E6D6',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 13,
  },
  commentsTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 16,
    marginBottom: 11,
    textAlign: 'right',
  },
  emptyComments: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 118,
    paddingVertical: 18,
  },
  emptyCommentsText: {
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  commentItem: {
    backgroundColor: '#F8F4ED',
    borderColor: '#EFE5D4',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 9,
    padding: 10,
  },
  commentHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  commentAuthor: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 12,
    textAlign: 'right',
  },
  commentMenuBtn: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  commentText: {
    color: '#566173',
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'right',
  },
  commentTime: {
    color: '#A0A8B5',
    fontFamily: 'Inter-Regular',
    fontSize: 10.5,
    marginTop: 4,
    textAlign: 'right',
  },
  stickyInput: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFDF8',
    borderTopColor: '#E9DEC9',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 13,
    paddingTop: 10,
  },
  commentInput: {
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
  commentSendBtn: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 13,
  },
  commentSendBtnDisabled: {
    backgroundColor: '#C9CEDA',
  },
  commentSendText: {
    color: '#fff',
    fontFamily: 'Inter-Black',
    fontSize: 13,
  },
  emptyTitle: {
    color: C.navy,
    fontFamily: 'Inter-Black',
    fontSize: 18,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: C.navy,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  backText: {
    color: '#fff',
    fontFamily: 'Inter-Black',
    fontSize: 13,
  },
  editModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,23,54,0.28)',
  },
  editSheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingBottom: 20,
    paddingHorizontal: 17,
    paddingTop: 16,
  },
  editHeader: {
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
  editTitle: {
    color: C.navy,
    flex: 1,
    fontFamily: 'Inter-Black',
    fontSize: 23,
    textAlign: 'right',
  },
  editInput: {
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
  saveBtn: {
    alignItems: 'center',
    backgroundColor: '#384CF4',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 58,
  },
  saveBtnDisabled: {
    backgroundColor: '#B9C0D4',
  },
  saveText: {
    color: '#fff',
    fontFamily: 'Inter-Black',
    fontSize: 17,
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
