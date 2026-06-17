/**
 * HelpButton — small "?" help icon for each screen header.
 *
 * Fetches per-page tutorial videos from platformSettings/support (pageHelp array).
 * On tap, opens an in-app bottom sheet listing that page's tutorial videos
 * (heading + YouTube thumbnail). Tapping a video opens it in YouTube/browser.
 * Always visible — even when no videos are configured (shows a friendly message).
 */

import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Linking,
  StyleSheet,
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from '../lib/db';
import { colors, fonts, radii } from '../theme';

interface TutorialVideo {
  id: string;
  title: string;
  url: string;
}
interface PageHelpEntry {
  pageId: string;
  pageTitle?: string;
  videoUrl?: string;
  docUrl?: string;
  videos?: TutorialVideo[];
}

// Cache to avoid re-fetching on every screen mount
let cachedPageHelp: PageHelpEntry[] | null = null;
let cachedSupportVideos: TutorialVideo[] = [];
let cachedSupport: { whatsappNumber?: string; supportEmail?: string } | null = null;
let fetchPromise: Promise<void> | null = null;

function loadPageHelp(): Promise<void> {
  if (cachedPageHelp) return Promise.resolve();
  if (fetchPromise) return fetchPromise;

  fetchPromise = firestore()
    .collection('platformSettings')
    .doc('support')
    .get()
    .then((snap: any) => {
      if (snap.exists) {
        const data = snap.data();
        cachedPageHelp = Array.isArray(data?.pageHelp) ? data.pageHelp : [];
        cachedSupportVideos = Array.isArray(data?.supportVideos) ? data.supportVideos : [];
        cachedSupport = {
          whatsappNumber: data?.whatsappNumber || '',
          supportEmail: data?.supportEmail || '',
        };
      } else {
        cachedPageHelp = [];
        cachedSupportVideos = [];
        cachedSupport = {};
      }
    })
    .catch(() => {
      cachedPageHelp = [];
      cachedSupportVideos = [];
      cachedSupport = {};
    })
    .finally(() => {
      fetchPromise = null;
    }) as Promise<void>;

  return fetchPromise!;
}

/** Collect every tutorial video across all pages + global support videos (deduped by URL). */
function collectAllVideos(): TutorialVideo[] {
  const seen = new Set<string>();
  const all: TutorialVideo[] = [];
  const push = (v: TutorialVideo) => {
    if (!v?.url || seen.has(v.url)) return;
    seen.add(v.url);
    all.push(v);
  };
  (cachedPageHelp || []).forEach((entry) => {
    if (Array.isArray(entry.videos)) entry.videos.forEach(push);
    else if (entry.videoUrl) push({ id: `${entry.pageId}-legacy`, title: entry.pageTitle || 'Tutorial', url: entry.videoUrl });
  });
  cachedSupportVideos.forEach(push);
  return all;
}

/** Extract a YouTube video ID from common URL formats for thumbnails. */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/
  );
  return m && m[1] ? m[1] : null;
}

/**
 * The bottom-sheet that lists tutorial videos. Reusable — used by the header "?"
 * button and by the Settings "Tutorial Videos" item (with allMode).
 */
export function TutorialVideosSheet({
  visible,
  onClose,
  pageId,
  allMode = false,
}: {
  visible: boolean;
  onClose: () => void;
  pageId?: string;
  allMode?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [allVideos, setAllVideos] = useState<TutorialVideo[]>([]);
  const [docUrl, setDocUrl] = useState<string>('');
  const [showAll, setShowAll] = useState(allMode);

  useEffect(() => {
    loadPageHelp().then(() => {
      const entry = pageId ? cachedPageHelp?.find((p) => p.pageId === pageId) : null;
      let list: TutorialVideo[] = Array.isArray(entry?.videos) ? entry!.videos! : [];
      if (list.length === 0 && entry?.videoUrl) {
        list = [{ id: 'legacy', title: 'Tutorial', url: entry.videoUrl }];
      }
      setVideos(list.filter((v) => v.url));
      setAllVideos(collectAllVideos());
      setDocUrl(entry?.docUrl || '');
    });
  }, [pageId, visible]);

  // Reset to the requested mode each time it opens
  useEffect(() => {
    if (visible) setShowAll(allMode);
  }, [visible, allMode]);

  const closeSheet = () => { setShowAll(allMode); onClose(); };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const contactSupport = () => {
    const wa = cachedSupport?.whatsappNumber;
    const email = cachedSupport?.supportEmail;
    if (wa) {
      openLink(`https://wa.me/${wa.replace(/[^0-9]/g, '')}`);
    } else if (email) {
      openLink(`mailto:${email}`);
    } else {
      openLink('https://laundrybill.com/help');
    }
  };

  // In allMode there's no per-page "back" — back button closes the sheet
  const canGoBackToPage = showAll && !allMode;

  return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
        <Pressable style={styles.overlay} onPress={closeSheet} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              {canGoBackToPage ? (
                <TouchableOpacity onPress={() => setShowAll(false)} hitSlop={8}>
                  <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
              ) : (
                <MaterialIcons name="play-circle-outline" size={22} color={colors.primary} />
              )}
              <Text style={styles.sheetTitle}>{showAll ? 'All Tutorial Videos' : 'Tutorial Videos'}</Text>
            </View>
            <TouchableOpacity onPress={closeSheet} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            {(() => {
              const list = showAll ? allVideos : videos;
              if (list.length > 0) {
                return list.map((v, i) => {
                  const ytId = getYouTubeId(v.url);
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                  return (
                    <TouchableOpacity
                      key={v.id || i}
                      style={styles.videoCard}
                      activeOpacity={0.8}
                      onPress={() => openLink(v.url)}
                    >
                      <View style={styles.thumbWrap}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.thumbFallback]}>
                            <MaterialIcons name="ondemand-video" size={28} color={colors.primary} />
                          </View>
                        )}
                        <View style={styles.playOverlay}>
                          <MaterialIcons name="play-arrow" size={22} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.videoInfo}>
                        <Text style={styles.videoTitle} numberOfLines={2}>{v.title || 'Tutorial'}</Text>
                        <Text style={styles.videoMeta}>Tap to watch</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                });
              }
              return (
                <View style={styles.emptyState}>
                  <MaterialIcons name="video-library" size={42} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No tutorials yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Tutorial videos for this page are coming soon.
                  </Text>
                </View>
              );
            })()}

            {/* See all videos — only on the per-page view when more exist elsewhere */}
            {!showAll && allVideos.length > videos.length && (
              <TouchableOpacity style={styles.seeAllRow} onPress={() => setShowAll(true)} activeOpacity={0.7}>
                <MaterialIcons name="video-library" size={18} color={colors.primary} />
                <Text style={styles.seeAllText}>See all videos ({allVideos.length})</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {!showAll && docUrl ? (
              <TouchableOpacity style={styles.docRow} onPress={() => openLink(docUrl)} activeOpacity={0.7}>
                <MaterialIcons name="description" size={18} color={colors.primary} />
                <Text style={styles.docText}>Read documentation</Text>
                <MaterialIcons name="open-in-new" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.supportRow} onPress={contactSupport} activeOpacity={0.7}>
              <MaterialIcons name="support-agent" size={18} color={colors.success} />
              <Text style={styles.supportText}>Still need help? Contact support</Text>
              <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
  );
}

/** The header "?" icon — opens the per-page tutorial videos sheet. */
export function HelpButton(_props: { pageId?: string }) {
  // "?" page-help button hidden in the Team app to keep ported headers clean;
  // TutorialVideosSheet (above) is the real one used by the manager Profile.
  return null;
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    borderRadius: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,29,46,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },

  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.button,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbWrap: { width: 96, height: 60, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb: { width: 96, height: 60, borderRadius: 10, backgroundColor: colors.border },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  videoInfo: { flex: 1, minWidth: 0 },
  videoTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  videoMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textSecondary },
  emptySubtitle: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },

  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.button,
    backgroundColor: colors.primaryTint,
    marginTop: 2,
    marginBottom: 4,
  },
  seeAllText: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  docText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  supportText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
});
