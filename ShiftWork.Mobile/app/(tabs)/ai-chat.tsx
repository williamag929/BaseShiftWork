import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/styles/theme';
import { useAuthStore } from '@/store/authStore';
import { mcpService, ChatMessage } from '@/services/mcp.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nextId = 1;
const uid = () => String(_nextId++);

const makeMessage = (
  role: ChatMessage['role'],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage => ({
  id: uid(),
  role,
  content,
  timestamp: new Date(),
  ...extra,
});

// Minimal markdown-like bold rendering (wraps **text** in bold spans)
const renderBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiChatScreen() {
  const { companyId, personId, name } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ---------- Boot: health check + welcome message -------------------------
  useEffect(() => {
    const boot = async () => {
      // Welcome message
      setMessages([
        makeMessage(
          'assistant',
          `👋 Hi${name ? ` ${name}` : ''}! I'm your ShiftWork AI assistant.\n\nI connect to the MCP server to fetch schedules, find unpublished shifts, and more.\n\nTry typing **"my schedule"**, **"tools"**, or **"ping"**.`,
        ),
      ]);

      // Check server health
      try {
        await mcpService.ping();
        setServerOnline(true);
      } catch {
        setServerOnline(false);
      }
    };
    boot();
  }, [name]);

  // ---------- Send message --------------------------------------------------
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    Keyboard.dismiss();
    const userMsg = makeMessage('user', text);
    const loadingMsg = makeMessage('assistant', '', { isLoading: true });

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await mcpService.chat(text, { companyId, personId });

      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== loadingMsg.id);
        const assistantMsg = makeMessage('assistant', res.reply, {
          toolName: res.toolUsed,
          toolResult: res.toolResult,
        });
        return [...next, assistantMsg];
      });

      // Update connectivity status on successful response
      setServerOnline(true);
    } catch (err: any) {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== loadingMsg.id);
        return [
          ...next,
          makeMessage('assistant', `⚠️ ${err?.message || 'Failed to reach MCP server.'}`),
        ];
      });
      setServerOnline(false);
    } finally {
      setSending(false);
    }
  }, [input, sending, companyId, personId]);

  // ---------- Quick action chips --------------------------------------------
  const quickActions = useMemo(
    () => [
      { label: '📅 My Schedule', msg: 'my schedule' },
      { label: '🔧 Tools', msg: 'tools' },
      { label: '📝 Unpublished', msg: 'unpublished schedules' },
      { label: '🏓 Ping', msg: 'ping' },
    ],
    [],
  );

  const tapQuick = useCallback(
    (msg: string) => {
      if (sending) return;
      setInput(msg);
      // Small delay so RN updates the input before sending
      setTimeout(() => {
        setInput('');
        const userMsg = makeMessage('user', msg);
        const loadingMsg = makeMessage('assistant', '', { isLoading: true });
        setMessages((prev) => [...prev, userMsg, loadingMsg]);
        setSending(true);

        mcpService
          .chat(msg, { companyId, personId })
          .then((res) => {
            setMessages((prev) => {
              const next = prev.filter((m) => m.id !== loadingMsg.id);
              return [
                ...next,
                makeMessage('assistant', res.reply, {
                  toolName: res.toolUsed,
                  toolResult: res.toolResult,
                }),
              ];
            });
            setServerOnline(true);
          })
          .catch((err) => {
            setMessages((prev) => {
              const next = prev.filter((m) => m.id !== loadingMsg.id);
              return [
                ...next,
                makeMessage('assistant', `⚠️ ${err?.message || 'Error'}`),
              ];
            });
            setServerOnline(false);
          })
          .finally(() => setSending(false));
      }, 50);
    },
    [sending, companyId, personId],
  );

  // ---------- Auto-scroll ---------------------------------------------------
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ---------- Render message bubble -----------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';

      if (item.isLoading) {
        return (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
          {!isUser && (
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {renderBold(item.content)}
            </Text>
            {item.toolName && (
              <View style={styles.toolBadge}>
                <Ionicons name="construct-outline" size={11} color={colors.primary} />
                <Text style={styles.toolBadgeText}>{item.toolName}</Text>
              </View>
            )}
            <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      );
    },
    [],
  );

  // ---------- Layout --------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
          <Text style={styles.headerTitle}>AI Assistant</Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusDot,
              serverOnline === true && styles.statusOnline,
              serverOnline === false && styles.statusOffline,
              serverOnline === null && styles.statusUnknown,
            ]}
          />
          <Text style={styles.statusText}>
            {serverOnline === true ? 'MCP Online' : serverOnline === false ? 'Offline' : 'Checking…'}
          </Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {quickActions.map((q) => (
          <TouchableOpacity
            key={q.msg}
            style={styles.quickChip}
            onPress={() => tapQuick(q.msg)}
            disabled={sending}
            activeOpacity={0.7}
          >
            <Text style={styles.quickChipText}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me about schedules…"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          onSubmitEditing={send}
          editable={!sending}
          multiline
          blurOnSubmit
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#aaa',
  },
  statusOnline: { backgroundColor: '#2ECC71' },
  statusOffline: { backgroundColor: '#E74C3C' },
  statusUnknown: { backgroundColor: '#F39C12' },
  statusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickChip: {
    backgroundColor: '#EBF2FC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  // Messages
  messagesList: {
    padding: 12,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  bubbleRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 2,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EBF2FC',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  toolBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.7)',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
