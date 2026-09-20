import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';

import NetInfo from '@react-native-community/netinfo';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeftIcon, SendIcon, RotateCcwIcon } from 'lucide-react-native';

import {
    COLORS,
    SPACING,
    TYPOGRAPHY,
    ROUNDING,
} from '../theme';

import {
    saveMessageLocal,
    getMessagesLocal,
} from '../database/messageRepository';

import SyncManager from '../sync/SyncManager';

import { DeviceEventEmitter } from 'react-native';

const CONVERSATION_ID = 'factory-safety-room-1';

export default function ConversationScreen({ navigation }) {
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [isOnline, setIsOnline] = useState(false);

    const loadMessages = async () => {
        try {
            const localMessages = await getMessagesLocal(
                CONVERSATION_ID
            );

            setMessages(localMessages);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    useEffect(() => {
        loadMessages();

        const unsubscribeNetwork = NetInfo.addEventListener(
            (state) => {
                setIsOnline(state.isConnected === true);
            }
        );

        const syncListener = DeviceEventEmitter.addListener(
            'messageSyncUpdated',
            loadMessages
        );

        const syncFinishedListener =
            DeviceEventEmitter.addListener(
                'messageSyncFinished',
                loadMessages
            );

        NetInfo.fetch().then((state) => {
            setIsOnline(state.isConnected === true);
        });

        return () => {
            unsubscribeNetwork();
            syncListener.remove();
            syncFinishedListener.remove();
        };
    }, []);

    const handleSend = async () => {
        const content = messageText.trim();

        if (!content) {
            return;
        }

        const newMessage = {
            clientMessageId: `msg_${uuidv4()}`,
            conversationId: CONVERSATION_ID,
            content,
            createdAt: new Date().toISOString(),
            deliveryState: 'pending',
            retryCount: 0,
            lastError: null,
        };

        try {
            // IMPORTANT:
            // Save locally BEFORE attempting network synchronization.
            await saveMessageLocal(newMessage);

            // Immediately show the message in the conversation.
            setMessages((currentMessages) => [
                ...currentMessages,
                newMessage,
            ]);

            setMessageText('');

            // If online, SyncManager will send it immediately.
            // If offline, it remains safely in SQLite.
            await SyncManager.forceSync();

        } catch (error) {
            console.error('Failed to save message:', error);

            Alert.alert(
                'Error',
                'The message could not be saved locally.'
            );
        }
    };

    const handleRetry = async () => {
        await SyncManager.forceSync();
        await loadMessages();
    };

    const renderMessage = ({ item }) => {
        const isFailed = item.deliveryState === 'failed';

        return (
            <View style={styles.messageContainer}>
                <View style={styles.messageBubble}>
                    <Text style={styles.messageText}>
                        {item.content}
                    </Text>

                    <View style={styles.messageFooter}>
                        <Text style={styles.timeText}>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>

                        <Text
                            style={[
                                styles.statusText,
                                isFailed && styles.failedStatus,
                            ]}
                        >
                            {item.deliveryState}
                        </Text>
                    </View>
                </View>

                {isFailed && (
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleRetry}
                    >
                        <RotateCcwIcon
                            size={16}
                            color={COLORS.primary}
                        />

                        <Text style={styles.retryText}>
                            Retry
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={
                Platform.OS === 'ios'
                    ? 'padding'
                    : undefined
            }
        >
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeftIcon
                        size={22}
                        color={COLORS.text}
                    />
                </TouchableOpacity>

                <View>
                    <Text style={TYPOGRAPHY.h2}>
                        Factory Safety
                    </Text>

                    <Text
                        style={[
                            styles.connectionText,
                            {
                                color: isOnline
                                    ? COLORS.success || '#4CAF50'
                                    : COLORS.textMuted,
                            },
                        ]}
                    >
                        {isOnline ? 'Online' : 'Offline'}
                    </Text>
                </View>

                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={messages}
                keyExtractor={(item) =>
                    item.clientMessageId
                }
                renderItem={renderMessage}
                contentContainerStyle={
                    messages.length === 0
                        ? styles.emptyList
                        : styles.messageList
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>
                            No messages yet
                        </Text>

                        <Text style={styles.emptyText}>
                            Send a safety message. It will be
                            saved locally even when you are offline.
                        </Text>
                    </View>
                }
            />

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="Report a safety issue..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                />

                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        !messageText.trim() &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!messageText.trim()}
                >
                    <SendIcon
                        size={20}
                        color="white"
                    />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    connectionText: {
        fontSize: 12,
        marginTop: 2,
    },

    messageList: {
        padding: SPACING.lg,
        paddingBottom: SPACING.md,
    },

    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
    },

    emptyContainer: {
        alignItems: 'center',
    },

    emptyTitle: {
        ...TYPOGRAPHY.h2,
        marginBottom: SPACING.sm,
    },

    emptyText: {
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },

    messageContainer: {
        marginBottom: SPACING.md,
        alignItems: 'flex-end',
    },

    messageBubble: {
        maxWidth: '85%',
        backgroundColor: COLORS.surface,
        borderRadius: ROUNDING.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    messageText: {
        color: COLORS.text,
        fontSize: 16,
        lineHeight: 22,
    },

    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },

    timeText: {
        color: COLORS.textMuted,
        fontSize: 11,
    },

    statusText: {
        color: COLORS.textMuted,
        fontSize: 11,
        textTransform: 'capitalize',
    },

    failedStatus: {
        color: '#E74C3C',
    },

    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },

    retryText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '600',
    },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.background,
    },

    input: {
        flex: 1,
        minHeight: 48,
        maxHeight: 120,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: ROUNDING.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        color: COLORS.text,
        fontSize: 16,
        marginRight: SPACING.sm,
    },

    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    sendButtonDisabled: {
        opacity: 0.5,
    },
});