import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, RefreshControl, DeviceEventEmitter } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, ROUNDING } from '../theme';
import { getHistoryIncidentsLocal } from '../database/incidentRepository';
import { INCIDENTS_API_URL } from '../config';
import { ArrowLeftIcon } from 'lucide-react-native';

export default function HistoryScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const loadIncidents = async () => {
    try {
      if (!isOnline) {
        // If offline, just show whatever local synced incidents we have
        const localData = await getHistoryIncidentsLocal();
        setIncidents(localData);
        return;
      }
      
      // Fetch full history from MongoDB API
      const response = await fetch(INCIDENTS_API_URL);
      if (response.ok) {
        const data = await response.json();
        setIncidents(data);
        console.log("History", data);
      } else {
        throw new Error('Failed to fetch from API');
      }
    } catch (error) {
      console.warn('Network request failed, falling back to local storage:', error.message);
      // Fallback to local
      const localData = await getHistoryIncidentsLocal();
      setIncidents(localData);
    }
  };

  useEffect(() => {
    loadIncidents();

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

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
    await loadIncidents();
    setRefreshing(false);
  };

  const renderIncidentCard = ({ item }) => {
    const status = item.syncStatus || 'synced';
    return (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('IncidentDetails', { incident: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={[styles.severityBadge, { borderColor: COLORS[item.severity] || COLORS.low }]}>
          <Text style={[styles.severityText, { color: COLORS[item.severity] || COLORS.low }]}>
            {(item.severity || 'low').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.locationText}>📍 {item.location}</Text>
      
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          {status === 'failed' && (
            <Text style={styles.errorText}>Retries: {item.retryCount} • {item.lastError}</Text>
          )}
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: COLORS[status] }]} />
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeftIcon size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={TYPOGRAPHY.h2}>Sync History</Text>
        <View style={styles.networkStatus}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.synced : COLORS.failed }]} />
          <Text style={styles.networkText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.clientIncidentId}
        renderItem={renderIncidentCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No synced incidents found.</Text>
            <Text style={styles.emptySubtext}>Once an incident successfully reaches the server, it will appear here.</Text>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  backIcon: {
    color: COLORS.text,
    fontSize: 20,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: ROUNDING.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: ROUNDING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    ...TYPOGRAPHY.title,
    flex: 1,
    marginRight: SPACING.md,
  },
  severityBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: ROUNDING.sm,
  },
  severityText: {
    fontSize: 10,
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
  statusText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    ...TYPOGRAPHY.title,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  }
});
