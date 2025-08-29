import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import {Platform} from 'react-native';
import {AuthProvider} from './context/AuthContext';

// Screens optimization disabled for macOS compatibility

const App = () => {
  return (
    <NavigationContainer>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
};

export default App;
