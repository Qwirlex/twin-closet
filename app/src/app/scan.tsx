import type { JobKind, SampleName } from '@twin/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icons';
import { JobNotice, JobSteps, ProgressBar } from '@/components/job-steps';
import { useFrameWidth } from '@/components/layout';
import { Cta, Glass, GlassButton, T } from '@/components/ui';
import { CLOSET, ME } from '@/data/demo';
import { fileUrl, startJob, uploadAsset, useJob } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { PHOTO_GLASS } from '@/theme/tokens';

// Скан шкафа и себя. Три пути, чтобы пройти шаг без камеры (судьи с ноутбука):
// снять видео, загрузить своё или взять готовое видео с сервера.

type Mode = 'rail' | 'single' | 'body';

const RAIL = ['hoodie', 'tee', 'blackjeans', 'boots'].map((id) => CLOSET.find((i) => i.id === id)!);

const COPY: Record<Mode, { title: string; hint: string; record: string; recordSub: string; upload: string; seconds: number }> = {
  rail: {
    title: 'Scan your closet',
    hint: 'Move slowly along the rail in one pass. Every piece is found, cut out and tagged for you.',
    record: 'Record the rail',
    recordSub: 'About 30 seconds, daylight',
    upload: 'Upload video',
    seconds: 45,
  },
  single: {
    title: 'Scan piece by piece',
    hint: 'Hold each piece up to the camera for two or three seconds. Shoes too.',
    record: 'Record pieces',
    recordSub: '2–3 seconds per piece',
    upload: 'Upload video',
    seconds: 90,
  },
  body: {
    title: 'Scan yourself',
    hint: 'Prop your phone up, step back until your feet are in frame and turn slowly for six seconds. One full-height photo also works.',
    record: 'Record a spin',
    recordSub: '6 seconds, full height',
    upload: 'Video or photo',
    seconds: 12,
  },
};

export default function ScanScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'body' ? 'body' : 'rail');
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { job, error: pollError } = useJob(jobId);
  const { addGarments } = useStore();
  const body = mode === 'body';
  const kind: JobKind = body ? 'body_scan' : 'closet_scan';
  const copy = COPY[mode];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function run(label: string, start: () => Promise<string | null>) {
    setError(null);
    setBusy(label);
    try {
      const id = await start();
      if (id) setJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const fromPicker = (camera: boolean) =>
    run(camera ? 'Opening the camera' : 'Uploading', async () => {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) throw new Error('Camera access is off. Turn it on in Settings, or upload a video instead.');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: body && !camera ? ['videos', 'images'] : ['videos'], videoMaxDuration: copy.seconds, quality: 1 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return null;
      setBusy('Uploading');
      const upload = await uploadAsset(res.assets[0]);
      return (await startJob(kind, { uploadId: upload.id })).id;
    });

  const fromSample = () => run('Starting', async () => (await startJob(kind, { sample: (body ? 'body' : 'closet') as SampleName })).id);

  const reset = () => {
    setJobId(null);
    setError(null);
  };

  const frames = job?.result.keyframes ?? [];
  const found = body ? (job?.result.body?.length ?? 0) : (job?.result.garments?.length ?? 0);
  const cols = 4;
  const cell = (width - 40 - (cols - 1) * 8) / cols;

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1C' }}>
      <LinearGradient colors={['#2A2826', '#161514', '#0E0E0F']} locations={[0, 0.6, 1]} style={{ position: 'absolute', inset: 0 }} />

      {frames.length ? (
        <View style={{ position: 'absolute', top: insets.top + 76, left: 20, right: 20, gap: 10 }}>
          <T size={11} w={600} upper color="#A8A29E">
            {frames.length === 1 ? 'Your photo' : `${frames.length} key frames from your video`}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {frames.map((f) => (
              <Image key={f} source={{ uri: fileUrl(f) }} contentFit="cover" style={{ width: frames.length === 1 ? cell * 2 : cell, height: (frames.length === 1 ? cell * 2 : cell) * 1.33, borderRadius: 10, backgroundColor: '#111' }} accessibilityLabel="Key frame" />
            ))}
          </View>
        </View>
      ) : body ? (
        <View style={{ position: 'absolute', top: insets.top + 70, left: 0, right: 0, alignItems: 'center' }}>
          <Image source={ME.front} contentFit="cover" style={{ width: 300, height: 400, opacity: 0.5 }} accessibilityLabel="How to stand: full height, feet in frame" />
          <Svg pointerEvents="none" style={{ position: 'absolute', top: 0 }} width={300} height={400} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5}>
            <Path d={corners(300, 400)} />
          </Svg>
        </View>
      ) : (
        <View style={{ position: 'absolute', top: insets.top + 100, left: 0, right: 0 }} accessibilityLabel={mode === 'rail' ? 'How to film: along the rail' : 'How to film: one piece at a time'}>
          {mode === 'rail' ? (
            <>
              <View style={{ height: 4, backgroundColor: '#3A3A3E' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 8 }}>
                {RAIL.map((g) => (
                  <View key={g.id} style={{ width: (width - 36) / 4 - 6, alignItems: 'center' }}>
                    <Svg width={30} height={22} viewBox="0 0 30 22" fill="none" stroke="#8A8784" strokeWidth={1.6} strokeLinecap="round" style={{ marginTop: -12 }}>
                      <Path d="M15 1v6M3 20l12-13 12 13" />
                    </Svg>
                    <Image source={g.image} contentFit="contain" contentPosition="top" style={{ width: '100%', height: 184, marginTop: -2, opacity: 0.8 }} accessible={false} />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 220, height: 260, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={RAIL[1].image} contentFit="contain" style={{ width: 200, height: 230 }} accessible={false} />
                <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 18 }} />
              </View>
            </View>
          )}
        </View>
      )}

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton variant="photo" icon="close" label="Close scan" onPress={close} />
        {body ? (
          <Glass variant="photo" style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={500} color={PHOTO_GLASS.text}>
              Body scan
            </T>
          </Glass>
        ) : (
          <Glass variant="photo" style={{ flexDirection: 'row', padding: 4, opacity: jobId ? 0.5 : 1 }}>
            {(
              [
                ['rail', 'Rail'],
                ['single', 'One by one'],
              ] as const
            ).map(([key, label]) => {
              const on = mode === key;
              return (
                <Pressable key={key} disabled={!!jobId} onPress={() => setMode(key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ minHeight: 44, paddingHorizontal: 15, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? '#F5F5F4' : 'transparent' }}>
                  <T size={13} w={on ? 500 : 400} color={on ? '#0B0B0C' : '#E7E5E4'}>
                    {label}
                  </T>
                </Pressable>
              );
            })}
          </Glass>
        )}
        <View style={{ width: 44 }} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '64%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: t.surface, borderTopWidth: 1, borderColor: t.line }}>
        <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }} bounces={false}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.line, alignSelf: 'center' }} />
          {!jobId ? (
            <>
              <View style={{ gap: 6 }}>
                <T size={26} tracking={-0.03} accessibilityRole="header">
                  {copy.title}
                </T>
                <T size={14} color={t.muted} lh={1.45}>
                  {copy.hint}
                </T>
              </View>
              <Cta title={copy.record} sub={busy ?? copy.recordSub} disabled={!!busy} onPress={() => fromPicker(true)} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Option icon="upload" label={copy.upload} disabled={!!busy} onPress={() => fromPicker(false)} />
                <Option icon="film" label={body ? 'Use a sample' : 'Use sample video'} disabled={!!busy} onPress={fromSample} />
              </View>
              {error ? (
                <T size={13} color={t.muted} lh={1.45} accessibilityLiveRegion="polite">
                  {error}
                </T>
              ) : null}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }} accessibilityLiveRegion="polite">
                  <T size={64} w={300} tracking={-0.04} lh={0.95}>
                    {found}
                  </T>
                  <T size={15} color={t.muted}>
                    {body ? 'of 4 angles' : found === 1 ? 'piece found' : 'pieces found'}
                  </T>
                </View>
                <T size={13} color={t.muted} style={{ marginBottom: 6 }} numberOfLines={1}>
                  {job?.result.media?.duration ? `${Math.round(job.result.media.duration)} s video` : job?.result.media ? 'Photo' : ''}
                </T>
              </View>
              <ProgressBar value={job?.percent ?? 0.02} />
              {job ? <JobSteps job={job} /> : <T color={t.muted}>Starting…</T>}
              <JobNotice job={job} error={pollError} />
              {job?.status === 'done' ? (
                <Cta
                  title={body ? 'See me' : 'See your closet'}
                  onPress={() => {
                    if (job.result.garments) addGarments(job.result.garments);
                    router.replace(body ? '/me' : '/');
                  }}
                />
              ) : null}
              {job?.status === 'failed' || pollError ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Option icon="refresh" label="Start over" onPress={reset} />
                  <Option icon="close" label="Close" onPress={close} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function Option({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
      <Glass style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}>
        <Icon name={icon} size={18} color={t.glass.text} />
        <T size={14} w={500} color={t.glass.text} numberOfLines={1}>
          {label}
        </T>
      </Glass>
    </Pressable>
  );
}

/** Уголки видоискателя */
function corners(w: number, h: number): string {
  const c = 24;
  return `M0 ${c}V0h${c}M${w - c} 0h${c}v${c}M${w} ${h - c}v${c}h-${c}M${c} ${h}H0v-${c}`;
}
