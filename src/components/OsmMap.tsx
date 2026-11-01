import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface OsmMarker {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}

interface OsmMapProps {
  center: { latitude: number; longitude: number };
  markers: OsmMarker[];
  onMarkerPress?: (id: string) => void;
  height?: number;
}

// OpenStreetMap asks apps to send a real Referer, so the page is given a base URL.
const BASE_URL = 'https://clinicconnect.app/';

function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #EEF0EA; }
  #offline { display: none; font-family: sans-serif; font-size: 13px; color: #666;
             text-align: center; padding-top: 70px; }
  .popup-title { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
  .popup-sub { font-size: 12px; color: #666; margin-bottom: 8px; }
  .popup-btn { background: #6B7C5C; color: #fff; border: 0; border-radius: 6px;
               padding: 6px 12px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<div id="map"></div>
<div id="offline">The map needs an internet connection.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('offline').style.display = 'block';
  } else {
    var map = L.map('map').setView([${lat}, ${lng}], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.circleMarker([${lat}, ${lng}], {
      radius: 8, color: '#ffffff', weight: 2, fillColor: '#4A90D9', fillOpacity: 1
    }).addTo(map).bindTooltip('You are here');

    var layer = L.layerGroup().addTo(map);

    window.setMarkers = function (list) {
      layer.clearLayers();
      list.forEach(function (m) {
        var box = document.createElement('div');
        var title = document.createElement('div');
        title.className = 'popup-title';
        title.textContent = m.title;
        box.appendChild(title);

        if (m.subtitle) {
          var sub = document.createElement('div');
          sub.className = 'popup-sub';
          sub.textContent = m.subtitle;
          box.appendChild(sub);
        }

        var btn = document.createElement('button');
        btn.className = 'popup-btn';
        btn.textContent = 'View clinic';
        btn.onclick = function () {
          window.ReactNativeWebView.postMessage(String(m.id));
        };
        box.appendChild(btn);

        L.circleMarker([m.latitude, m.longitude], {
          radius: 9, color: '#ffffff', weight: 2, fillColor: '#6B7C5C', fillOpacity: 1
        }).addTo(layer).bindPopup(box);
      });
    };
  }
</script>
</body>
</html>`;
}

export default function OsmMap({ center, markers, onMarkerPress, height = 180 }: OsmMapProps) {
  const webRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => buildHtml(center.latitude, center.longitude), [center.latitude, center.longitude]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(
      `window.setMarkers && window.setMarkers(${JSON.stringify(markers)}); true;`
    );
  }, [ready, markers]);

  const handleMessage = (event: WebViewMessageEvent) => {
    onMarkerPress?.(event.nativeEvent.data);
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: BASE_URL }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        onLoadEnd={() => setReady(true)}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={(req: any) => {
          if (
            req.url.startsWith(BASE_URL) ||
            req.url.startsWith('about:') ||
            req.url.startsWith('data:')
          ) {
            return true;
          }

          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#EEF0EA' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});