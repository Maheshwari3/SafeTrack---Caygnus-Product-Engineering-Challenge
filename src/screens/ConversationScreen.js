import React, { useEffect, useState, useCallback } from 'react';
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
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
    ArrowLeftIcon,
    SendIcon,
    RotateCcwIcon,
    SlidersIcon,
    Trash2Icon,
    CheckCircle2Icon,
    ClockIcon,
    AlertTriangleIcon,
    RefreshCwIcon,
} from 'lucide-react-native';

import {
    COLORS,
    SPACING,
    TYPOGRAPHY,
    ROUNDING,
} from '../theme';

import {
    saveMessageLocal,
    getMessagesLocal,
    getMessageQueueSummaryLocal,
    clearAllMessagesLocal,
} from '../database/messageRepository';

import SyncManager, { MAX_AUTO_RETRIES } from '../sync/SyncManager';
import { DeviceEventEmitter } from 'react-native';

const CONVERSATION_ID = 'factory-safety-room-1';

export default function ConversationScreen({ navigation }) {
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [isOnline, setIsOnline] = useState(false);
    const [showSimPanel, setShowSimPanel] = useState(false);

    // Simulation toggles
    const [simOffline, setSimOffline] = useState(false);
    const [simFailure, setSimFailure] = useState(false);
    const [simLostAck, setSimLostAck] = useState(false);

    // Queue summary counters
    const [summary, setSummary] = useState({
        pending: 0,
        sending: 0,
        failed: 0,
        delivered: 0,
    });

    const loadMessages = useCallback(async () => {
        try {
            const localMessages = await getMessagesLocal(CONVERSATION_ID);
            setMessages(localMessages);

            const qSummary = await getMessageQueueSummaryLocal();
            setSummary(qSummary);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }, []);

    useEffect(() => {
        loadMessages();

        const unsubscribeNetwork = NetInfo.addEventListener((state) => {
            const online = state.isConnected === true;
            setIsOnline(online && !SyncManager.simulateOffline);
        });

        const syncListener = DeviceEventEmitter.addListener(
            'messageSyncUpdated',
            loadMessages
        );

        const syncFinishedListener = DeviceEventEmitter.addListener(
            'messageSyncFinished',
            loadMessages
        );

        NetInfo.fetch().then((state) => {
            setIsOnline(state.isConnected === true && !SyncManager.simulateOffline);
        });

        return () => {
            unsubscribeNetwork();
            syncListener.remove();
            syncFinishedListener.remove();
        };
    }, [loadMessages]);

    // Handle Reviewer Simulation Toggles
    const handleToggleSimOffline = (val) => {
        setSimOffline(val);
        SyncManager.setSimulateOffline(val);
        setIsOnline(!val && SyncManager.isOnline);
    };

    const handleToggleSimFailure = (val) => {
        setSimFailure(val);
        SyncManager.setSimulateFailure(val);
    };

    const handleToggleSimLostAck = (val) => {
        setSimLostAck(val);
        SyncManager.setSimulateLostAck(val);
    };

    const handleSend = async () => {
        const content = messageText.trim();
        if (!content) return;

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
            // AC1: Save locally in SQLite BEFORE attempting network synchronization
            await saveMessageLocal(newMessage);

            // Immediately show in UI with pending state
            setMessageText('');
            await loadMessages();

            // Trigger sync if online
            SyncManager.syncPendingMessages();
        } catch (error) {
            console.error('Failed to save message:', error);
            Alert.alert('Error', 'The message could not be saved locally.');
        }
    };

    // Manual retry for a specific message
    const handleSingleRetry = async (clientMessageId) => {
        await SyncManager.retryMessage(clientMessageId);
        await loadMessages();
    };

    // Force sync all eligible / failed messages
    const handleForceSyncAll = async () => {
        await SyncManager.forceSync();
        await loadMessages();
    };

    // Pre-populate 10 benchmark messages while offline
    const handleQueueBenchmarkBatch = async () => {
        const timestampBase = Date.now();
        for (let i = 1; i <= 10; i++) {
            const msg = {
                clientMessageId: `bench_${uuidv4().substring(0, 8)}_${i}`,
                conversationId: CONVERSATION_ID,
                content: `Benchmark Safety Report #${i} [Pressure Valve ${i * 10} PSI]`,
                createdAt: new Date(timestampBase + i * 1000).toISOString(),
                deliveryState: 'pending',
                retryCount: 0,
                lastError: null,
            };
            await saveMessageLocal(msg);
        }
        await loadMessages();
        Alert.alert(
            'Benchmark Batch Queued',
            '10 messages queued in SQLite outbox with pending state. Toggle offline/online or run sync to test.'
        );
    };

    // Clear local conversation for fresh testing
    const handleClearConversation = async () => {
        await clearAllMessagesLocal(CONVERSATION_ID);
        await loadMessages();
    };

    const renderDeliveryBadge = (item) => {
        switch (item.deliveryState) {
            case 'delivered':
                return (
                    <View style={[styles.badge, styles.badgeDelivered]}>
                        <CheckCircle2Icon size={12} color="#2ECC71" />
                        <Text style={styles.badgeTextDelivered}>Delivered</Text>
                    </View>
                );
            case 'sending':
                return (
                    <View style={[styles.badge, styles.badgeSending]}>
                        <RefreshCwIcon size={12} color="#3498DB" />
                        <Text style={styles.badgeTextSending}>Sending...</Text>
                    </View>
                );
            case 'failed':
                return (
                    <View style={[styles.badge, styles.badgeFailed]}>
                        <AlertTriangleIcon size={12} color="#E74C3C" />
                        <Text style={styles.badgeTextFailed}>
                            Failed ({item.retryCount || 0}/{MAX_AUTO_RETRIES})
                        </Text>
                    </View>
                );
            case 'pending':
            default:
                return (
                    <View style={[styles.badge, styles.badgePending]}>
                        <ClockIcon size={12} color="#F39C12" />
                        <Text style={styles.badgeTextPending}>Pending</Text>
                    </View>
                );
        }
    };

    const renderMessage = ({ item }) => {
        const isFailed = item.deliveryState === 'failed';

        return (
            <View style={styles.messageContainer}>
                <View style={styles.messageBubble}>
                    <Text style={styles.messageText}>{item.content}</Text>

                    {item.lastError ? (
                        <Text style={styles.errorSnippet} numberOfLines={1}>
                            Error: {item.lastError}
                        </Text>
                    ) : null}

                    <View style={styles.messageFooter}>
                        <Text style={styles.timeText}>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })}
                        </Text>
                        {renderDeliveryBadge(item)}
                    </View>
                </View>

                {isFailed && (
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => handleSingleRetry(item.clientMessageId)}
                        activeOpacity={0.7}
                    >
                        <RotateCcwIcon size={14} color={COLORS.primary} />
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Screen Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <ArrowLeftIcon size={20} color={COLORS.text} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <Text style={TYPOGRAPHY.h2}>Safety Conversation</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: isOnline ? '#2ECC71' : '#E74C3C' },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.connectionText,
                                    { color: isOnline ? '#2ECC71' : COLORS.textMuted },
                                ]}
                            >
                                {isOnline ? 'Online' : 'Offline'}
                                {simOffline ? ' [Simulated]' : ''}
                            </Text>
                        </View>
                    </View>

                    {/* Simulation Panel Toggle Button */}
                    <TouchableOpacity
                        style={[styles.toolButton, showSimPanel && styles.toolButtonActive]}
                        onPress={() => setShowSimPanel(!showSimPanel)}
                    >
                        <SlidersIcon size={18} color={showSimPanel ? '#FFFFFF' : COLORS.text} />
                    </TouchableOpacity>
                </View>

                {/* Reviewer Simulation & Diagnostic Panel */}
                {showSimPanel && (
                    <View style={styles.simPanel}>
                        <View style={styles.simPanelHeader}>
                            <Text style={styles.simPanelTitle}>Reviewer Simulation Controls</Text>
                            <TouchableOpacity onPress={handleForceSyncAll} style={styles.miniSyncBtn}>
                                <RefreshCwIcon size={13} color="#FFFFFF" />
                                <Text style={styles.miniBtnText}>Sync All</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Queue Metrics Summary */}
                        <View style={styles.queueMetricsRow}>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricVal}>{summary.pending}</Text>
                                <Text style={styles.metricLabel}>Pending</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <Text style={[styles.metricVal, { color: '#3498DB' }]}>{summary.sending}</Text>
                                <Text style={styles.metricLabel}>Sending</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <Text style={[styles.metricVal, { color: '#E74C3C' }]}>{summary.failed}</Text>
                                <Text style={styles.metricLabel}>Failed</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <Text style={[styles.metricVal, { color: '#2ECC71' }]}>{summary.delivered}</Text>
                                <Text style={styles.metricLabel}>Delivered</Text>
                            </View>
                        </View>

                        {/* Simulation Switches */}
                        {/* <View style={styles.simSwitchRow}>
                            <Text style={styles.switchLabel}>Simulate Offline:</Text>
                            <Switch
                                value={simOffline}
                                onValueChange={handleToggleSimOffline}
                                trackColor={{ false: '#3A3A3C', true: '#E74C3C' }}
                            />
                        </View>

                        <View style={styles.simSwitchRow}>
                            <Text style={styles.switchLabel}>Simulate 503 Temp Error:</Text>
                            <Switch
                                value={simFailure}
                                onValueChange={handleToggleSimFailure}
                                trackColor={{ false: '#3A3A3C', true: '#F39C12' }}
                            />
                        </View>

                        <View style={styles.simSwitchRow}>
                            <Text style={styles.switchLabel}>Simulate Lost Ack (Drop response):</Text>
                            <Switch
                                value={simLostAck}
                                onValueChange={handleToggleSimLostAck}
                                trackColor={{ false: '#3A3A3C', true: '#9B59B6' }}
                            />
                        </View> */}

                        {/* Benchmark & Maintenance Buttons */}
                        <View style={styles.simActionRow}>
                            <TouchableOpacity
                                style={styles.simActionBtn}
                                onPress={handleQueueBenchmarkBatch}
                            >
                                <Text style={styles.simActionText}>Queue 10 Benchmark Msgs</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.simActionBtn, styles.simActionBtnDanger]}
                                onPress={handleClearConversation}
                            >
                                <Trash2Icon size={14} color="#E74C3C" />
                                <Text style={[styles.simActionText, { color: '#E74C3C' }]}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Messages List */}
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.clientMessageId}
                    renderItem={renderMessage}
                    contentContainerStyle={
                        messages.length === 0 ? styles.emptyList : styles.messageList
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No messages in outbox</Text>
                            <Text style={styles.emptyText}>
                                Type a message below. Messages are saved locally to SQLite before transmission and synchronized automatically when online.
                            </Text>
                        </View>
                    }
                />

                {/* Message Input Bar */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={messageText}
                        onChangeText={setMessageText}
                        placeholder="Report safety observation..."
                        placeholderTextColor={COLORS.textMuted}
                        multiline
                    />

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            !messageText.trim() && styles.sendButtonDisabled,
                        ]}
                        onPress={handleSend}
                        disabled={!messageText.trim()}
                    >
                        <SendIcon size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        gap: 12,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    toolButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    toolButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    connectionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    simPanel: {
        backgroundColor: '#1E1E24',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    simPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    simPanelTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E0E0E0',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    miniSyncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: ROUNDING.sm,
    },
    miniBtnText: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    queueMetricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background,
        borderRadius: ROUNDING.sm,
        padding: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    metricItem: {
        alignItems: 'center',
        flex: 1,
    },
    metricVal: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    metricLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    simSwitchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    switchLabel: {
        fontSize: 13,
        color: COLORS.text,
    },
    simActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: SPACING.sm,
    },
    simActionBtn: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 7,
        borderRadius: ROUNDING.sm,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    simActionBtnDanger: {
        flex: 0.4,
        borderColor: '#E74C3C50',
    },
    simActionText: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
    },
    messageList: {
        padding: SPACING.md,
        paddingBottom: SPACING.lg,
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.xl,
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
        fontSize: 14,
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
        fontSize: 15,
        lineHeight: 21,
    },
    errorSnippet: {
        color: '#E74C3C',
        fontSize: 11,
        marginTop: 4,
        fontStyle: 'italic',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    timeText: {
        color: COLORS.textMuted,
        fontSize: 10,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgePending: {
        backgroundColor: '#F39C1220',
    },
    badgeTextPending: {
        color: '#F39C12',
        fontSize: 10,
        fontWeight: '600',
    },
    badgeSending: {
        backgroundColor: '#3498DB20',
    },
    badgeTextSending: {
        color: '#3498DB',
        fontSize: 10,
        fontWeight: '600',
    },
    badgeFailed: {
        backgroundColor: '#E74C3C20',
    },
    badgeTextFailed: {
        color: '#E74C3C',
        fontSize: 10,
        fontWeight: '600',
    },
    badgeDelivered: {
        backgroundColor: '#2ECC7120',
    },
    badgeTextDelivered: {
        color: '#2ECC71',
        fontSize: 10,
        fontWeight: '600',
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
        fontSize: 12,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: ROUNDING.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        color: COLORS.text,
        fontSize: 15,
        marginRight: SPACING.sm,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.4,
    },
});