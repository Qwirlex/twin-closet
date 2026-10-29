import { BODY_VIEWS, bodyCue, bodyCueText, checkPose, FRAME, poseShift, type BodyCue, type BodyView, type PosePoint } from '@twin/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { LiveVideo, useLiveCamera, VoiceToggle } from '@/components/live-video';
import { Cta, GlassButton, Label, T } from '@/components/ui';
import { detectPose, FrameReader, grab, loadPose, setVoice, shutter, speak, voiceOn, type CapturedShot } from '@/lib/live-camera';
import { isDesktopWeb } from '@/lib/platform';
import { useTheme } from '@/theme/theme';

// Скан себя с подсказками (вариант C из макетов): подготовка → живая камера с тренером и голосом → 4 ракурса сами
// снимаются, когда поза верная и человек стоит неподвижно → проверка, любой ракурс можно переснять отдельно.
// Поза — MediaPipe на устройстве; не загрузилась — снимаем по таймеру, с проверкой света и неподвижности

const LABEL: Record<BodyView, string> = { front: 'Front', three_quarter: '¾', side: 'Side', back: 'Back' };
/** сколько держать позу, прежде чем снимок сделается сам */
const HOLD_MS = 900;
const GOLD = '#C8B68A';

type Stage = 'setup' | 'live' | 'review';

export function BodyScan({ onDone, onClose, onUpload, onSample, onPhone, busy, error }: { onDone: (shots: CapturedShot[]) => void; onClose: () => void; onUpload: () => void; onSample: () => void; onPhone?: () => void; busy: string | null; error: string | null }) {
  const [stage, setStage] = useState<Stage>('setup');
  const [shots, setShots] = useState<Partial<Record<BodyView, CapturedShot>>>({});
  /** переснять только один ракурс и вернуться к проверке */
  const [only, setOnly] = useState<BodyView | null>(null);

  // модель позы грузим сразу, пока человек читает подготовку
  useEffect(() => {
    void loadPose().catch(() => undefined);
  }, []);

  const save = (view: BodyView, shot: CapturedShot) => {
    setShots((s) => {
      const old = s[view];
      if (old) URL.revokeObjectURL(old.uri);
      return { ...s, [view]: shot };
    });
  };

  if (stage === 'setup') return <Setup onStart={() => setStage('live')} onClose={onClose} onUpload={onUpload} onSample={onSample} onPhone={onPhone} busy={busy} error={error} />;
  if (stage === 'live')
    return (
      <Live
        shots={shots}
        only={only}
        onBack={() => setStage(Object.keys(shots).length ? 'review' : 'setup')}
        onShot={save}
        onFinished={() => {
          setOnly(null);
          setStage('review');
        }}
        onClose={onClose}
      />
    );
  return (
    <Review
      shots={shots}
      busy={busy}
      error={error}
      onRetake={(v) => {
        setOnly(v);
        setStage('live');
      }}
      onUse={() => onDone(BODY_VIEWS.flatMap((v) => (shots[v] ? [shots[v]!] : [])))}
      onClose={onClose}
    />
  );
}

function Setup({ onStart, onClose, onUpload, onSample, onPhone, busy, error }: { onStart: () => void; onClose: () => void; onUpload: () => void; onSample: () => void; onPhone?: () => void; busy: string | null; error: string | null }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [voice, setVoiceState] = useState(voiceOn);
  const desktop = isDesktopWeb();
  const steps = [desktop ? 'Laptop on a table or chair, screen facing you' : 'Phone at waist height, screen facing you', 'Plain wall, bright room or daylight', 'Fitted clothes, hair off the shoulders', 'Step back about 2 m, face the camera'];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon="close" label="Close scan" onPress={onClose} />
        <T size={13} color={t.muted}>
          About 1 minute
        </T>
      </View>

      <View style={{ height: 190, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel="Prop the phone at waist height and stand about two metres away">
        <Svg width={320} height={170} viewBox="0 0 350 190" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 172 H330" stroke={t.line} strokeWidth={1.5} />
          <Path d="M46 172 V118 H96 V172 M46 138 H96" stroke={t.muted} strokeWidth={2} />
          <Path d="M62 88 h18 v30 h-18 z" stroke={GOLD} strokeWidth={2} />
          <Path d="M86 102 L236 60 M86 104 L236 172" stroke={GOLD} strokeWidth={1} strokeDasharray="3 5" />
          <Circle cx={262} cy={46} r={10} stroke={t.text} strokeWidth={2} />
          <Path d="M262 57 V118 M262 70 L244 106 M262 70 L280 106 M262 118 L252 170 M262 118 L272 170" stroke={t.text} strokeWidth={2.2} />
          <Path d="M100 184 H240 M100 180 V188 M240 180 V188" stroke={t.muted} strokeWidth={1} />
        </Svg>
      </View>

      <View style={{ gap: 6 }}>
        <Label accent>Scan yourself</Label>
        <T size={30} tracking={-0.03} lh={1.08} accessibilityRole="header">
          Set up once, then just listen
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          The camera tells you how to stand and takes four photos by itself: front, ¾, side and back.
        </T>
      </View>

      <View style={{ borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
        {steps.map((s, i) => (
          <View key={s} style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
            <T size={13} color={t.accent} style={{ width: 16 }}>
              {i + 1}
            </T>
            <T size={15} style={{ flex: 1 }}>
              {s}
            </T>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => {
          setVoice(!voice);
          setVoiceState(!voice);
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: voice }}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={voice ? 'sound' : 'mute'} size={20} color={t.accent} />
          <T size={15}>Voice guide</T>
        </View>
        <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: voice ? t.accent : t.surface2, alignItems: voice ? 'flex-end' : 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: voice ? t.onAccent : t.muted }} />
        </View>
      </Pressable>

      {error ? (
        <T size={13} color={t.warn} lh={1.45} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}

      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Cta
          title="Start the camera"
          sub={busy ?? 'Live hints, takes 4 photos by itself'}
          disabled={!!busy}
          onPress={() => {
            // на iPhone голос включается только из нажатия
            speak('Stand about two metres from the camera, facing it.');
            onStart();
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16 }}>
          {onPhone ? <Link label="Scan with your phone" onPress={onPhone} /> : null}
          <Link label="Upload a video or photo" onPress={onUpload} disabled={!!busy} />
          <Link label="Use the sample" onPress={onSample} disabled={!!busy} />
        </View>
      </View>
    </ScrollView>
  );
}

function Link({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
      <T size={14} color={t.text} style={{ textDecorationLine: 'underline' }}>
        {label}
      </T>
    </Pressable>
  );
}

function Live({ shots, only, onShot, onFinished, onBack, onClose }: { shots: Partial<Record<BodyView, CapturedShot>>; only: BodyView | null; onShot: (v: BodyView, s: CapturedShot) => void; onFinished: () => void; onBack: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cam = useLiveCamera('user', true);
  const [target, setTarget] = useState<BodyView | null>(() => only ?? BODY_VIEWS.find((v) => !shots[v]) ?? null);
  const [cue, setCue] = useState<BodyCue>('loading');
  const [hold, setHold] = useState(0);
  const [poseFailed, setPoseFailed] = useState(false);
  const [flash, setFlash] = useState(false);
  const taken = useRef(shots);
  taken.current = shots;

  useEffect(() => {
    if (cam.state !== 'live' || !target) return;
    const video = cam.video.current!;
    const reader = new FrameReader();
    const clock = { t: 0 };
    let model: Awaited<ReturnType<typeof loadPose>> | null = null;
    let failed = false;
    let alive = true;
    let raf = 0;
    let last = 0;
    let prevPose: PosePoint[] | null = null;
    let holdSince = 0;
    let shown: BodyCue = 'loading';
    let shownSince = 0;
    let spoken: { cue: BodyCue | ''; at: number } = { cue: '', at: 0 };
    let capturing = false;
    const startedAt = performance.now();

    loadPose()
      .then((m) => (model = m))
      .catch(() => {
        failed = true;
        setPoseFailed(true);
      });

    const capture = async () => {
      capturing = true;
      try {
        const blob = await grab(video);
        shutter();
        setHold(0);
        setFlash(true);
        setTimeout(() => setFlash(false), 180);
        const shot: CapturedShot = { view: target, blob, uri: URL.createObjectURL(blob) };
        onShot(target, shot);
        const after = { ...taken.current, [target]: shot };
        const following = only ? null : (BODY_VIEWS.find((v) => !after[v]) ?? null);
        if (!following) {
          speak('Done. Have a look.');
          onFinished();
          return;
        }
        speak(`Got it. ${bodyCueText('turn', following).title}.`);
        spoken = { cue: 'turn', at: performance.now() };
        setTarget(following);
      } catch {
        capturing = false;
      }
    };

    const tick = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (now - last < 90 || capturing) return;
      last = now;
      const q = reader.read(video);
      if (!q) return;
      let c: BodyCue;
      let steady = q.move < FRAME.still;
      if (model) {
        const lm = detectPose(model, video, clock);
        const pc = checkPose(lm);
        // свет меряем по корпусу человека (плечи–бёдра), а не по всему кадру с тёмной стеной
        const light = pc.person && lm ? (reader.lightIn(Math.min(lm[11].x, lm[12].x, lm[23].x, lm[24].x), Math.min(lm[11].y, lm[12].y), Math.max(lm[11].x, lm[12].x, lm[23].x, lm[24].x), Math.max(lm[23].y, lm[24].y)) ?? q.light) : q.light;
        c = bodyCue(pc, light, target);
        // в разработке видно, что видит проверка (для автотестов с поддельной камерой)
        if (__DEV__) (globalThis as { __twinScan?: unknown }).__twinScan = { target, cue: c, pose: pc, frame: q };
        steady = steady && poseShift(prevPose, lm) < 0.012;
        prevPose = lm;
      } else if (failed) {
        // без позы: свет и неподвижность, плюс 3 секунды встать в ракурс
        c = q.light < FRAME.dark ? 'light' : now - startedAt < 3000 ? 'turn' : 'ok';
      } else c = 'loading';
      if (c === 'ok' && !steady) c = 'still';

      if (c === 'ok') {
        holdSince ||= now;
        const p = Math.min(1, (now - holdSince) / HOLD_MS);
        setHold(p);
        if (p >= 1) void capture();
      } else if (holdSince) {
        holdSince = 0;
        setHold(0);
      }

      if (c !== shown) {
        shown = c;
        shownSince = now;
        setCue(c);
      }
      // говорим команду, когда она держится полсекунды и не повторяем одно и то же чаще раза в 4 с
      if (shown !== 'ok' && shown !== 'still' && shown !== 'loading' && now - shownSince > 500 && (spoken.cue !== shown || now - spoken.at > 4000)) {
        speak(bodyCueText(shown, target).title);
        spoken = { cue: shown, at: now };
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // onShot/onFinished стабильны по смыслу; цикл перезапускается при смене ракурса
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.state, target]);

  const view = target ?? 'front';
  const text = cam.state === 'error' ? { title: 'Camera is off', sub: cam.error ?? '' } : bodyCueText(cue, view);
  const step = BODY_VIEWS.indexOf(view) + 1;
  const turning = cue === 'turn';

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <LiveVideo video={cam.video} mirror landscape={cam.landscape} />
      <LinearGradient pointerEvents="none" colors={['rgba(11,11,12,0.55)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0.94)']} locations={[0, 0.2, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {flash ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.35)' }} /> : null}

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton variant="photo" icon="close" label="Close scan" onPress={onClose} />
        <VoiceToggle />
      </View>

      <View style={{ position: 'absolute', top: insets.top + 68, right: 16, width: 116, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 10, borderRadius: 18, backgroundColor: 'rgba(20,20,22,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={turning ? 'Turn on the spot' : 'Arms out a little, feet apart'}>
        <Svg width={64} height={100} viewBox="0 0 64 104" fill="none" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {turning ? (
            <>
              <Circle cx={32} cy={14} r={8} />
              <Path d="M32 23v36M32 59l-6 40M32 59l6 40M32 32l-8 22M32 32l8 22" />
              <Path d="M10 72a24 9 0 0 0 44 0" />
              <Path d="M50 66l4 6-7 2" />
            </>
          ) : (
            <>
              <Circle cx={32} cy={12} r={8} />
              <Path d="M32 21v38M32 30L14 52M32 30l18 22M32 59l-10 40M32 59l10 40" />
            </>
          )}
        </Svg>
        <T size={11} lh={1.3} color="#E7E5E4" style={{ textAlign: 'center' }}>
          {turning ? 'Turn on the spot' : 'Arms out a little, feet apart'}
        </T>
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 28, gap: 14 }}>
        {poseFailed ? (
          <T size={12} color="#D6D3D1">
            Pose guide didn’t load. Photos are taken when you hold still.
          </T>
        ) : null}
        <View accessibilityLiveRegion="assertive">
          <T size={42} w={500} tracking={-0.03} lh={1.04} color="#F5F5F4">
            {text.title}
          </T>
          <T size={15} lh={1.4} color="#D6D3D1" style={{ marginTop: 8 }}>
            {text.sub}
          </T>
        </View>
        {cam.state === 'error' ? <Cta title="Back" sub="Upload a photo or use the sample instead" onPress={onBack} /> : null}
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} accessible={false}>
          <View style={{ width: `${Math.round(hold * 100)}%`, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {BODY_VIEWS.map((v) => (
            <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 30, borderRadius: 999, borderWidth: 1, borderColor: v === view ? '#F5F5F4' : shots[v] ? 'rgba(200,182,138,0.6)' : 'rgba(255,255,255,0.2)', backgroundColor: v === view ? 'rgba(245,245,244,0.12)' : 'transparent' }}>
              {shots[v] && v !== view ? <Icon name="check" size={12} color={GOLD} stroke={2.6} /> : null}
              <T size={12} w={v === view ? 500 : 400} color={v === view ? '#F5F5F4' : '#A8A29E'}>
                {LABEL[v]}
              </T>
            </View>
          ))}
          <T size={12} color="#A8A29E" style={{ marginLeft: 'auto' }}>
            {`${step} of 4`}
          </T>
        </View>
      </View>
    </View>
  );
}

function Review({ shots, busy, error, onRetake, onUse, onClose }: { shots: Partial<Record<BodyView, CapturedShot>>; busy: string | null; error: string | null; onRetake: (v: BodyView) => void; onUse: () => void; onClose: () => void }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const ready = BODY_VIEWS.filter((v) => shots[v]).length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon="close" label="Close scan" onPress={onClose} />
        <T size={13} color={t.muted}>{`${ready} of 4 ready`}</T>
      </View>
      <View style={{ gap: 6 }}>
        <Label accent>Check your scan</Label>
        <T size={28} tracking={-0.03} lh={1.1} accessibilityRole="header">
          {ready === 4 ? 'All four look good' : 'Almost there'}
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          Tap any photo to retake just that one.
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {BODY_VIEWS.map((v) => {
          const s = shots[v];
          return (
            <Pressable key={v} onPress={() => onRetake(v)} accessibilityRole="button" accessibilityLabel={s ? `${LABEL[v]}: retake` : `${LABEL[v]}: take`} style={{ width: '48%', aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', backgroundColor: t.surface, borderWidth: 1, borderColor: s ? t.line : t.warn }}>
              {s ? <Image source={{ uri: s.uri }} contentFit="cover" style={{ width: '100%', height: '100%' }} accessible={false} /> : null}
              <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 28, borderRadius: 999, backgroundColor: 'rgba(20,20,22,0.75)' }}>
                <Icon name={s ? 'check' : 'refresh'} size={12} color={s ? GOLD : '#F0B79C'} stroke={2.6} />
                <T size={12} color="#F5F5F4">
                  {s ? LABEL[v] : `${LABEL[v]} · take it`}
                </T>
              </View>
              <View style={{ position: 'absolute', right: 8, top: 8 }}>
                <Icon name="refresh" size={16} color="rgba(245,245,244,0.8)" />
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <T size={13} color={t.warn} lh={1.45} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}
      <View style={{ marginTop: 'auto' }}>
        <Cta title={`Use ${ready === 4 ? 'these 4' : `these ${ready}`}`} sub={busy ?? 'Your photos go to your private scan'} disabled={!!busy || !shots.front} onPress={onUse} />
      </View>
    </ScrollView>
  );
}
