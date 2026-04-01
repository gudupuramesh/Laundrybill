/**
 * App Update Modal
 * Shows when a new version is available on Play Store / App Store.
 * - Optional update: user can dismiss ("Later")
 * - Force update: no dismiss button, must update
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { AppUpdateInfo } from '../lib/useAppUpdateChecker';

interface Props {
  info: AppUpdateInfo;
  onDismiss: () => void;
}

export default function UpdateModal({ info, onDismiss }: Props) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="system-update" size={40} color="#0f766e" />
          </View>

          <Text style={styles.title}>New Update Available</Text>
          <Text style={styles.version}>Version {info.latestVersion}</Text>

          {info.whatsNew ? (
            <Text style={styles.whatsNew}>{info.whatsNew}</Text>
          ) : (
            <Text style={styles.whatsNew}>
              A new version of LaundryBill is available with improvements and bug fixes.
            </Text>
          )}

          <TouchableOpacity style={styles.updateBtn} onPress={info.openStore} activeOpacity={0.8}>
            <MaterialIcons name="download" size={20} color="#fff" />
            <Text style={styles.updateBtnText}>Update Now</Text>
          </TouchableOpacity>

          {!info.forceUpdate && (
            <TouchableOpacity style={styles.laterBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.laterBtnText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconWrap: {
    backgroundColor: '#f0fdfa',
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 12,
  },
  whatsNew: {
    fontSize: 14,
    color: '#52525b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: '100%',
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#71717a',
    fontSize: 14,
    fontWeight: '600',
  },
});
