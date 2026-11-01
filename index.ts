import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 60, paddingHorizontal: 16 } },
    React.createElement(
      Text,
      { style: { fontSize: 18, fontWeight: '700', color: '#B00020', marginBottom: 8 } },
      title
    ),
    React.createElement(
      ScrollView,
      null,
      React.createElement(
        Text,
        { selectable: true, style: { fontSize: 12, color: '#222222' } },
        message
      )
    )
  );
}

class Guard extends React.Component<{ children?: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return React.createElement(ErrorScreen, {
        title: 'ClinicConnect hit an error while running',
        message: String(this.state.error.stack || this.state.error.message),
      });
    }
    return this.props.children;
  }
}

let Root: React.ComponentType;

try {
  // Loaded inside try/catch so an error while the app's files load is shown instead of closing the app.
  const App = require('./App').default;
  Root = () => React.createElement(Guard, null, React.createElement(App));
} catch (e: any) {
  Root = () =>
    React.createElement(ErrorScreen, {
      title: 'ClinicConnect failed to start',
      message: String((e && (e.stack || e.message)) || e),
    });
}

registerRootComponent(Root);