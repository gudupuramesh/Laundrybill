import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Modal, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

interface Msg91WebViewProps {
  visible: boolean;
  phoneNumber: string;
  onSuccess: (data: any) => void;
  onFailure: (error: any) => void;
  onClose: () => void;
}

export default function Msg91WebView({ visible, phoneNumber, onSuccess, onFailure, onClose }: Msg91WebViewProps) {
  const { t } = useTranslation();
  // Strip +91 for the identifier if needed, though the web widget generally supports it.
  const cleanPhone = phoneNumber.startsWith('+91') ? phoneNumber.substring(3) : phoneNumber;

  const loaderText = t('mobile.msg91SecureLoading').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://verify.msg91.com/otp-provider.js"></script>
  <style>
    body { margin: 0; padding: 0; background-color: #f8f9fb; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
    .loader { text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="loader" id="loader">${loaderText}</div>
  <script>
    var loaded = false;
    var attempts = 0;
    function checkAndLoad() {
      if (window.initSendOTP && !loaded) {
        loaded = true;
        document.getElementById("loader").style.display = "none";
        
        try {
          window.initSendOTP({
            widgetId: "356b766a3237343037343235",
            tokenAuth: "449167TcQzNJeWfJC68c632aaP1",
            identifier: "${cleanPhone}",
            exposeMethods: false,
            success: function(data) {
               window.ReactNativeWebView.postMessage(JSON.stringify({ type: "success", data: data }));
            },
            failure: function(error) {
               window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", error: error }));
            }
          });
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", error: e.toString() }));
        }
      } else if (!loaded) {
        attempts++;
        if (attempts > 25) { // 5 seconds timeout
           window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", error: "Failed to load MSG91 script" }));
        } else {
          setTimeout(checkAndLoad, 200);
        }
      }
    }
    checkAndLoad();
  </script>
</body>
</html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#191c1e" />
            </TouchableOpacity>
          </View>
          
          {/* WebView Container */}
          <View style={styles.webviewContainer}>
            <WebView
              originWhitelist={['*']}
              source={{ html: htmlContent }}
              style={styles.webview}
              scalesPageToFit={true}
              bounces={false}
              scrollEnabled={false}
              onMessage={(event) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data);
                  if (payload.type === 'success') {
                    onSuccess(payload.data);
                  } else if (payload.type === 'error') {
                    onFailure(payload.error);
                  }
                } catch (e) {
                  onFailure(t('mobile.msg91InvalidWebViewMessage'));
                }
              }}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#00408f" />
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    marginTop: 'auto',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: {
    padding: 8,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
