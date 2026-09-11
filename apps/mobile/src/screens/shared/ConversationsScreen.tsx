import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { messageApi } from '../../api/patient';
import { EmptyState } from '../../components/Card';
import { colors } from '../../theme/colors';
import { useSocket } from '../../hooks/useSocket';

interface Conversation {
  partnerId: string;
  partner: { name: string; role: string };
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export function ConversationsScreen({ navigation }: any) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const load = useCallback(() => {
    messageApi.listConversations().then(setConversations).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocket({ 'message:new': load });

  return (
    <FlatList
      style={{ backgroundColor: colors.white }}
      data={conversations}
      keyExtractor={(c) => c.partnerId}
      ListEmptyComponent={<EmptyState icon="💬" title="No messages yet" subtitle="Conversations with your care team will show up here." />}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Chat', { partnerId: item.partnerId, partnerName: item.partner.name })}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.partner.name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.partner.name}</Text>
              <Text style={styles.time}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.preview, item.unread && styles.unread]}>
              {item.lastMessage}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: 12, color: colors.textLight },
  preview: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  unread: { color: colors.textPrimary, fontWeight: '600' },
});
