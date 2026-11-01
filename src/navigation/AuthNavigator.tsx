import React from 'react';
import { View, Text } from 'react-native';

/** Reserved for future nested navigators. App currently uses a single Root stack. */
export default function PlaceholderNavigator() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Navigator placeholder</Text>
    </View>
  );
}
