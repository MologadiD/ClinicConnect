import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onFinish: () => void;
}

const PILLS = ['BOOK', 'CARE', 'CONNECT'];

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const containerOpacity = useRef(new Animated.Value(1)).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const ringProgress = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(10)).current;

  const pillAnims = useRef(PILLS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animation = Animated.sequence([
      // 1. Logo mark springs in with soft pulse ring
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(ringProgress, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 2. Wordmark + tagline
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(150),
          Animated.parallel([
            Animated.timing(taglineOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(taglineTranslateY, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // 3. BOOK • CARE • CONNECT
      Animated.stagger(
        140,
        pillAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        )
      ),

      Animated.delay(700),

      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onFinishRef.current();
    });

    return () => animation.stop();
  }, [
    containerOpacity,
    logoOpacity,
    logoScale,
    ringProgress,
    textOpacity,
    textTranslateY,
    taglineOpacity,
    taglineTranslateY,
    pillAnims,
  ]);

  const ringScale = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.75],
  });
  const ringOpacity = ringProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });

  return (
    <Animated.View style={[styles.root, { opacity: containerOpacity }]}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#AD8B6B', '#DCCBBB', '#FFFFFF']}
        locations={[0, 0.28, 0.55]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Official logo mark from brand PDF */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.ring,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            }}
            accessible
            accessibilityLabel="ClinicConnect logo"
          >
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Wordmark — Clinic (dark) + Connect (sage green) */}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          }}
        >
          <Text style={styles.logoText}>
            <Text style={styles.logoClinic}>Clinic</Text>
            <Text style={styles.logoConnect}>Connect</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={{
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          }}
        >
          <Text style={styles.tagline}>Connecting Patients With Healthcare</Text>
        </Animated.View>

        {/* BOOK • CARE • CONNECT */}
        <View style={styles.pillsRow}>
          {PILLS.map((label, i) => (
            <Animated.View
              key={label}
              style={[styles.pillItem, { opacity: pillAnims[i] }]}
            >
              <View style={styles.pillCol}>
                <Text style={styles.pill}>{label}</Text>
                {i === 0 && <View style={styles.pillUnderline} />}
              </View>
              {i < PILLS.length - 1 && <Text style={styles.pillDot}>•</Text>}
            </Animated.View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2F5BEA',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  logoClinic: {
    color: '#1B2E1F',
  },
  logoConnect: {
    color: '#6B8F71',
  },
  tagline: {
    fontSize: 14,
    color: '#8A9BB0',
    textAlign: 'center',
    marginBottom: 18,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pillItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pillCol: {
    alignItems: 'center',
  },
  pill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B2E1F',
    letterSpacing: 1.4,
  },
  pillUnderline: {
    marginTop: 3,
    height: 2.5,
    width: 28,
    backgroundColor: '#E5A100',
    borderRadius: 2,
  },
  pillDot: {
    fontSize: 11,
    color: '#E5A100',
    marginHorizontal: 8,
    marginTop: 1,
  },
});
