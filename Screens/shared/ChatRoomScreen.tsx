import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { getCurrentUser } from '../services/authService';
import { COLORS, SPACING, TYPO, SHADOWS, RADIUS } from '../constants/theme';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export default function ChatRoomScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { contactId, contactName, contactRole } = route.params;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let subscription: any;

    const initChat = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setCurrentUser(user);

      // Try to fetch messages from Supabase
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      } else {
        // If table doesn't exist yet, we just start with empty messages
        console.log('Messages table not found or empty:', error?.message);
      }
      setLoading(false);

      // Subscribe to real-time messages
      subscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === contactId) ||
            (newMsg.sender_id === contactId && newMsg.receiver_id === user.id)
          ) {
            setMessages(prev => {
              // Jika ID sama, pasti duplikat
              if (prev.some(m => m.id === newMsg.id)) return prev;

              // Cari pesan optimistic yang baru dikirim (ID-nya angka/Date.now() dan kontennya sama)
              const optimisticIndex = prev.findIndex(m => 
                m.sender_id === newMsg.sender_id && 
                m.content === newMsg.content && 
                !m.id.includes('-') // UUID Supabase pasti ada '-'
              );

              if (optimisticIndex !== -1) {
                // Timpa pesan sementara dengan pesan asli dari database
                const updated = [...prev];
                updated[optimisticIndex] = newMsg;
                return updated;
              }

              // Jika bukan dari kita atau pesan lama, tambahkan ke daftar
              return [...prev, newMsg];
            });
          }
        })
        .subscribe();
    };

    initChat();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [contactId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser) return;

    const newMsg: Message = {
      id: Date.now().toString(), // temporary ID
      sender_id: currentUser.id,
      receiver_id: contactId,
      content: inputText.trim(),
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    // Send to Supabase
    const { error } = await supabase.from('messages').insert([
      {
        sender_id: currentUser.id,
        receiver_id: contactId,
        content: newMsg.content,
      }
    ]);

    if (error) {
      console.log('Error sending message. Table "messages" might not exist yet.', error.message);
      // Keep it in local state anyway so it feels functional during development
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUser?.id;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleRight : styles.msgBubbleLeft]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextRight : styles.msgTextLeft]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.msgTime}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Ionicons name={contactRole === 'doctor' ? 'medkit' : 'person'} size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{contactName}</Text>
          <Text style={styles.headerSub}>{contactRole === 'doctor' ? 'Dokter' : 'Pasien'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatArea}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Ketik pesan..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { backgroundColor: COLORS.borderLight }]} 
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={!inputText.trim() ? COLORS.textMuted : '#fff'} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.xxl : SPACING.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: { ...TYPO.h4, color: COLORS.textPrimary },
  headerSub: { ...TYPO.caption, color: COLORS.primary },
  
  container: { flex: 1 },
  chatArea: { padding: SPACING.md, paddingBottom: SPACING.xl },
  
  msgWrapper: { marginBottom: SPACING.md, maxWidth: '80%' },
  msgRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  
  msgBubble: { padding: 12, borderRadius: RADIUS.lg },
  msgBubbleRight: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgBubbleLeft: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.borderLight },
  
  msgText: { ...TYPO.body },
  msgTextRight: { color: '#fff' },
  msgTextLeft: { color: COLORS.textPrimary },
  
  msgTime: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 4, fontSize: 10 },
  
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingBottom: Platform.OS === 'ios' ? 32 : SPACING.md,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8F9FE',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 100,
    ...TYPO.body,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: SPACING.sm,
  },
});
