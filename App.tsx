import React, { useEffect, useState } from 'react';
import { StatusBar, SafeAreaView, View, StyleSheet, BackHandler, Text } from 'react-native';
import { COLORS } from './src/theme';

import DashboardScreen from './src/screens/DashboardScreen';
import CreateIncidentScreen from './src/screens/CreateIncidentScreen';
import IncidentDetailsScreen from './src/screens/IncidentDetailsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { initializeDB } from './src/database/database';
import SyncManager from './src/sync/SyncManager'; 

function App() {
  const [currentRoute, setCurrentRoute] = useState({ name: 'Dashboard', params: {} });
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    initializeDB()
      .then(() => {
        setIsDBReady(true);
        SyncManager.init();
      })
      .catch(console.error);

    const backAction = () => {
      if (currentRoute.name !== 'Dashboard') {
        setCurrentRoute({ name: 'Dashboard', params: {} });
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentRoute]);

  const navigation = {
    navigate: (name, params = {}) => setCurrentRoute({ name, params }),
    goBack: () => setCurrentRoute({ name: 'Dashboard', params: {} })
  };

  const renderScreen = () => {
    switch (currentRoute.name) {
      case 'CreateIncident':
        return <CreateIncidentScreen navigation={navigation} />;
      case 'IncidentDetails':
        return <IncidentDetailsScreen route={{ params: currentRoute.params }} navigation={navigation} />;
      case 'History':
        return <HistoryScreen navigation={navigation} />;
      case 'Dashboard':
      default:
        return <DashboardScreen navigation={navigation} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {isDBReady ? renderScreen() : (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{color: COLORS.text}}>Loading...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  }
});

export default App;
