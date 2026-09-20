import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, ROUNDING } from '../theme';
import 'react-native-get-random-values'; // Needed for uuid in React Native
import { v4 as uuidv4 } from 'uuid';
import { saveIncidentLocal } from '../database/incidentRepository';
import SyncManager from '../sync/SyncManager';
import { ArrowLeftIcon } from 'lucide-react-native';

const SEVERITY_LEVELS = [
  { id: 'low', label: 'Low', color: COLORS.low },
  { id: 'medium', label: 'Medium', color: COLORS.medium },
  { id: 'high', label: 'High', color: COLORS.high },
  { id: 'critical', label: 'Critical', color: COLORS.critical },
];

export default function CreateIncidentScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');

  const handleSubmit = async () => {
    if (!title || !location || !description) {
      Alert.alert("Missing Fields", "Please fill out the Title, Location, and Description before saving.");
      return;
    }

    const newIncident = {
      clientIncidentId: `inc_${uuidv4()}`,
      title,
      location,
      severity,
      description,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending', // Initial offline status
      retryCount: 0,
      lastError: null,
    };

    try {
      await saveIncidentLocal(newIncident);
      console.log("Saved locally:", newIncident.clientIncidentId);
      
      // Trigger background sync
      SyncManager.forceSync();
      
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save incident:', error);
      Alert.alert("Error", "Failed to save the incident locally.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              {/* <Text style={styles.backIcon}>←</Text> */}
              <ArrowLeftIcon size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={TYPOGRAPHY.h2}>Report Incident</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Incident Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Machine Overheating"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sector 4, Machine #12"
              placeholderTextColor={COLORS.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.severityContainer}>
              {SEVERITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.severityOption,
                    severity === level.id && { backgroundColor: level.color + '30', borderColor: level.color }
                  ]}
                  onPress={() => setSeverity(level.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.severityLabel,
                    { color: severity === level.id ? level.color : COLORS.textMuted }
                  ]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what happened in detail..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={styles.submitButtonText}>Save Incident</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
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
    alignContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backIcon: {
    color: COLORS.text,
    fontSize: 25,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.title,
    fontSize: 16,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ROUNDING.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    paddingTop: SPACING.md,
  },
  severityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  severityOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    borderRadius: ROUNDING.sm,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: ROUNDING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    ...TYPOGRAPHY.title,
    color: 'white',
  }
});
