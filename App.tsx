import React, { useEffect, useState } from 'react';
import { StatusBar, SafeAreaView, View, StyleSheet, Text } from 'react-native';
import { COLORS } from './src/theme';

import { initializeDB } from './src/database/database';
import SyncManager from './src/sync/SyncManager';
import ConversationScreen from './src/screens/ConversationScreen';

function App() {
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    initializeDB()
      .then(() => {
        setIsDBReady(true);
        SyncManager.init();
      })
      .catch(console.error);

    return () => {
      SyncManager.destroy();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {isDBReady ? (
        <ConversationScreen />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={{ color: COLORS.text }}>Loading SafeTrack...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
