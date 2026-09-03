import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { messageApi } from '../../api/patient';
import { useAuth } from '../../context/AuthContext';
import { colors, radius } from '../../theme/colors';
import { useSocket } from '../../hooks/useSocket';

interface Message { id: string; senderId: string; content: string; createdAt: string; }

export function ChatScreen({ route, navigation }: any) {
  const { partnerId, partnerName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: partnerName });
  }, [navigation, partnerName]);

  const load = useCallback(() => {
    messageApi.getThread(partnerId).then(setMessages).catch(() => {});
  }, [partnerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useSocket({
    'message:new': (msg: Message) => {
      if (msg.senderId === partnerId) setMessages((prev) => [...prev, msg]);
    },
  });

  const send = async () => {
    if (!draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    const optimistic: Message = { id: `temp-${Date.now()}`, senderId: user!.id, content, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    await messageApi.send(partnerId, content).catch(() => {});
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={mine ? styles.textMine : styles.textTheirs}>{item.content}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <TextInput style={styles.input} placeholder="Type a message..." value={draft} onChangeText={setDraft} onSubmitEditing={send} />
        <Pressable style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: radius.md, marginBottom: 8 },
  bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  textMine: { color: '#fff', fontSize: 15 },
  textTheirs: { color: colors.textPrimary, fontSize: 15 },
  inputBar: { flexDirection: 'row', padding: 12, backgroundColor: colors.white, alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendText: { color: '#fff', fontWeight: '700' },
});
