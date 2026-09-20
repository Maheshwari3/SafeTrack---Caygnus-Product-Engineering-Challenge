import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, RefreshControl, DeviceEventEmitter } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, ROUNDING } from '../theme';
import { getIncidentsLocal, getQueueSummaryLocal } from '../database/incidentRepository';
import SyncManager from '../sync/SyncManager';
import { History, MessageCircleMore } from 'lucide-react-native';
import { INCIDENTS_API_URL } from '../config';

export default function DashboardScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [queueSummary, setQueueSummary] = useState({ pending: 0, syncing: 0, failed: 0, synced: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const loadIncidents = async (onlineState = isOnline) => {
    try {
      const data = await getIncidentsLocal();
      const summary = await getQueueSummaryLocal();

      if (onlineState) {
        try {
          const response = await fetch(INCIDENTS_API_URL);
          if (response.ok) {
            const apiData = await response.json();
            if (Array.isArray(apiData)) {
              summary.synced = Math.max(summary.synced, apiData.length);
            }
          }
        } catch (apiError) {
          console.warn('Could not fetch server synced count:', apiError.message);
        }
      }

      setIncidents(data);
      setQueueSummary(summary);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadIncidents();

    // Listen to network changes to update the UI badge and synced count
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      loadIncidents(state.isConnected);
    });


    // Auto-reload the list when background sync finishes!
    const syncSubscription = DeviceEventEmitter.addListener('syncFinished', () => {
      loadIncidents();
    });

    return () => {
      unsubscribeNetInfo();
      syncSubscription.remove();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await SyncManager.forceSync();
    await loadIncidents();
    setRefreshing(false);
  };

  const renderQueueSummary = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Queue Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: COLORS.pending }]}>{queueSummary.pending}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Syncing</Text>
          <Text style={[styles.summaryValue, { color: COLORS.syncing }]}>{queueSummary.syncing}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Failed</Text>
          <Text style={[styles.summaryValue, { color: COLORS.failed }]}>{queueSummary.failed}</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Synced</Text>
          <Text style={[styles.summaryValue, { color: COLORS.synced }]}>{queueSummary.synced}</Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('IncidentDetails', { incident: item })}>
      <View style={styles.cardHeader}>
        <Text style={styles.incidentTitle}>{item.title}</Text>
        <View style={[styles.severityBadge, { backgroundColor: COLORS[item.severity] + '20' }]}>
          <Text style={[styles.severityText, { color: COLORS[item.severity] }]}>
            {item.severity.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.locationText}>📍 {item.location}</Text>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          {item.syncStatus === 'failed' && (
            <Text style={styles.errorText}>Retries: {item.retryCount} • {item.lastError}</Text>
          )}
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: COLORS[item.syncStatus] }]} />
          <Text style={styles.statusText}>{item.syncStatus.toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={TYPOGRAPHY.h1}>SafeTrack</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.networkStatus}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.synced : COLORS.failed }]} />
            <Text style={styles.networkText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <View style={{flexDirection:'row',gap:4}}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => navigation.navigate('Conversation')}
            >
              <MessageCircleMore size={20} color={COLORS.text} />
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border }}
              onPress={() => navigation.navigate('History')}
            >
              <History size={20} color={COLORS.text} />
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.clientIncidentId}
        renderItem={renderItem}
        ListHeaderComponent={renderQueueSummary}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: COLORS.textMuted }}>No incidents reported yet.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => navigation.navigate('CreateIncident')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: {
    ...TYPOGRAPHY.title,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: ROUNDING.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  networkText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    marginLeft: SPACING.xs,
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: ROUNDING.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: ROUNDING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100, // Space for FAB
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: ROUNDING.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  incidentTitle: {
    ...TYPOGRAPHY.title,
    flex: 1,
    marginRight: SPACING.sm,
  },
  severityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: ROUNDING.sm,
  },
  severityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  dateText: {
    ...TYPOGRAPHY.caption,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.failed,
    marginTop: 2,
    maxWidth: 200,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    marginLeft: 6,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    backgroundColor: COLORS.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
    lineHeight: 36,
  }
});

