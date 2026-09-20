import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, ROUNDING } from '../theme';
import SyncManager from '../sync/SyncManager';
import { ArrowLeftIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IncidentDetailsScreen({ route, navigation }) {
  // We'll pass the incident as a param
  const incident = route?.params?.incident || {
    id: '1', title: 'Machine Overheating', location: 'Machine #12', 
    severity: 'high', status: 'pending', createdAt: '2026-09-18T10:00:00Z',
    description: 'The machine started smoking and temperature gauge exceeded max limits. Turned off immediately but needs inspection.',
    clientIncidentId: 'inc_123'
  };
  const severity = incident.severity || 'low';
  const status = incident.status || incident.syncStatus || 'synced';

  const handleRetry = async () => {
    await SyncManager.forceSync();
    navigation.goBack(); // Go back to dashboard so it refreshes
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeftIcon size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={TYPOGRAPHY.h2}>Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{incident.title}</Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: (COLORS[severity] || COLORS.low) + '20' }]}>
              <Text style={[styles.badgeText, { color: COLORS[severity] || COLORS.low }]}>
                {severity.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }]}>
              <View style={[styles.statusDot, { backgroundColor: COLORS[status] || COLORS.synced }]} />
              <Text style={[styles.badgeText, { color: COLORS.text, marginLeft: 4 }]}>
                {status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>{new Date(incident.createdAt).toLocaleString()}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{incident.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Incident ID</Text>
            <Text style={styles.infoValue}>{incident.clientIncidentId || incident.id}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>Description</Text>
          <Text style={styles.descriptionText}>{incident.description}</Text>

        </View>
        
        {status === 'failed' && (
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.8} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry Sync</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingTop: SPACING.xs,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    marginTop: SPACING.sm,
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: ROUNDING.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titleRow: {
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  badge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: ROUNDING.sm,
    marginRight: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  infoRow: {
    marginBottom: SPACING.md,
  },
  infoLabel: {
    ...TYPOGRAPHY.caption,
    marginBottom: 4,
  },
  infoValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  descriptionText: {
    ...TYPOGRAPHY.body,
    lineHeight: 24,
    marginTop: 4,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: ROUNDING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    ...TYPOGRAPHY.title,
    color: 'white',
  }
});
