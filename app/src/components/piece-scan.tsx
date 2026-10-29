import { itemCue, itemCueText, type ItemCue, type ItemStep } from '@twin/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { LiveVideo, useLiveCamera } from '@/components/live-video';
import { Cta, Glass, GlassButton, T } from '@/components/ui';
import { FrameReader, grab, shutter, speak, type CapturedShot } from '@/lib/live-camera';
import { PHOTO_GLASS } from '@/theme/tokens';

// Вещь по одной (дома: перед → спина → ярлык) и в магазине (бирка → перед → спина). Снимок сам, когда кадр
// светлый, резкий и неподвижный; бирке и ярлыку нужна резкость выше — там текст. Каждый шаг можно переснять

const GOLD = '#C8B68A';
const HOLD_MS = 700;

const STEPS: Record<'closet' | 'store', ItemStep[]> = { closet: ['front', 'back', 'label'], store: ['tag', 'front', 'back'] };
const NAME: Record<ItemStep, string> = { front: 'Front', back: 'Back', label: 'Label close-up', tag: 'Tag' };
const ASK: Record<ItemStep, { title: string; sub: string }> = {
  front: { title: 'Show the front', sub: 'Hold it up or lay it flat, whole piece inside the corners' },
  back: { title: 'Now turn it over', sub: 'The back, whole piece inside the corners' },
  label: { title: 'The label, up close', sub: 'Size and fabric label, fill the corners with it' },
  tag: { title: 'Fill the corners with the tag', sub: 'We read the code, size, price and fabric from it' },
};
/** без чего вещь не сохранить */
const NEED: ItemStep[] = ['front'];

export function PieceScan({ mode, onSave, onClose }: { mode: 'closet' | 'store'; onSave: (shots: CapturedShot[]) => Promise<void>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const steps = STEPS[mode];
  const [shots, setShots] = useState<Partial<Record<ItemStep, CapturedShot>>>({});
  const [step, setStep] = useState<ItemStep | null>(steps[0]);
  const [cue, setCue] = useState<ItemCue>('blur');
  const [hold, setHold] = useState(0);
  const [flash, setFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cam = useLiveCamera('environment', true);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  useEffect(() => {
    if (cam.state !== 'live' || !step) return;
    const video = cam.video.current!;
    const reader = new FrameReader();
    let alive = true;
    let raf = 0;
    let last = 0;
    let holdSince = 0;
    let shown: ItemCue | '' = '';
    let capturing = false;
    const startedAt = performance.now();

    const capture = async () => {
      capturing = true;
      try {
        const blob = await grab(video);
        shutter();
        setHold(0);
        setFlash(true);
        setTimeout(() => setFlash(false), 160);
        const shot: CapturedShot = { view: step, blob, uri: URL.createObjectURL(blob) };
        const after = { ...shotsRef.current, [step]: shot };
        setShots(after);
        const following = steps.find((s) => !after[s]) ?? null;
        setStep(following);
        if (following) speak(ASK[following].title);
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
      // первую секунду даём навести камеру
      const c: ItemCue = now - startedAt < 1000 ? 'still' : itemCue(q, step);
      // в разработке видно, что видит проверка (для автотестов с поддельной камерой)
      if (__DEV__) (globalThis as { __twinPiece?: unknown }).__twinPiece = { step, cue: c, frame: q };
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
        setCue(c);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // steps постоянны для режима; цикл перезапускается на каждом шаге
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.state, step]);

  const retake = (s: ItemStep) => {
    setError(null);
    setStep(s);
    speak(ASK[s].title);
  };

  const skip = () => {
    if (!step) return;
    const following = steps.find((s) => s !== step && !shots[s] && steps.indexOf(s) > steps.indexOf(step)) ?? null;
    setStep(following);
  };

  const reset = () => {
    Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.uri));
    setShots({});
    setStep(steps[0]);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(steps.flatMap((s) => (shots[s] ? [shots[s]!] : [])));
      setSaved((n) => n + 1);
      speak(mode === 'store' ? 'Saved. Find it in Try.' : 'Saved. Next piece.');
      if (mode === 'store') onClose();
      else reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const text = cam.state === 'error' ? { title: 'Camera is off', sub: cam.error ?? '' } : step ? (cue === 'ok' || cue === 'still' ? (hold > 0 ? itemCueText('ok', step) : ASK[step]) : itemCueText(cue, step)) : { title: 'Looks good', sub: 'Tap a photo to retake it, or save the piece' };
  const ready = NEED.every((s) => shots[s]);
  const frame = step === 'tag' || step === 'label' ? { top: '30%', side: '16%', height: '24%' } : { top: '19%', side: '8%', height: '46%' };

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0E0F' }}>
      {/* видео не снимаем с экрана: поток камеры привязан к этому элементу, пересъёмка идёт без нового запроса */}
      <LiveVideo video={cam.video} mirror={false} landscape={cam.landscape} />
      {!step ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,14,15,0.93)' }} /> : null}
      <LinearGradient pointerEvents="none" colors={['rgba(11,11,12,0.6)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0)', 'rgba(11,11,12,0.94)']} locations={[0, 0.18, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {flash ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.35)' }} /> : null}

      {step ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: frame.top as `${number}%`, left: frame.side as `${number}%`, right: frame.side as `${number}%`, height: frame.height as `${number}%` }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" stroke={cue === 'ok' ? GOLD : 'rgba(255,255,255,0.85)'} strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke">
            <Path d="M0 12V0h12 M88 0h12v12 M100 88v12H88 M12 100H0V88" vectorEffect="non-scaling-stroke" />
          </Svg>
        </View>
      ) : null}

      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton variant="photo" icon="close" label="Close scan" onPress={onClose} />
        <Glass variant="photo" style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: 'center' }}>
          <T size={13} w={500} color={PHOTO_GLASS.text}>
            {mode === 'store' ? 'In a store' : `Piece ${saved + 1}`}
          </T>
        </Glass>
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
          {saved ? (
            <Glass variant="photo" style={{ minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' }}>
              <T size={13} color={PHOTO_GLASS.text}>{`${saved} saved`}</T>
            </Glass>
          ) : null}
        </View>
      </View>

      <View style={{ position: 'absolute', top: insets.top + 64, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {steps.map((s) => {
          const on = s === step;
          return (
            <View key={s} style={{ minHeight: 30, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: on ? '#F5F5F4' : shots[s] ? 'rgba(200,182,138,0.16)' : 'transparent', borderWidth: on ? 0 : 1, borderColor: shots[s] ? 'rgba(200,182,138,0.6)' : 'rgba(255,255,255,0.22)' }}>
              {shots[s] && !on ? <Icon name="check" size={12} color={GOLD} stroke={2.6} /> : null}
              <T size={12} w={on ? 500 : 400} color={on ? '#0B0B0C' : shots[s] ? '#F5F5F4' : '#A8A29E'}>
                {NAME[s]}
              </T>
            </View>
          );
        })}
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 26, gap: 14 }}>
        <View accessibilityLiveRegion="polite">
          <T size={30} w={500} tracking={-0.02} lh={1.08} color="#F5F5F4">
            {text.title}
          </T>
          <T size={14} lh={1.4} color="#D6D3D1" style={{ marginTop: 6 }}>
            {text.sub}
          </T>
        </View>
        {step ? (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} accessible={false}>
            <View style={{ width: `${Math.round(hold * 100)}%`, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {steps.map((s) => (
            <Pressable key={s} onPress={() => retake(s)} accessibilityRole="button" accessibilityLabel={shots[s] ? `${NAME[s]}: retake` : `${NAME[s]}: take`} style={{ width: 46, height: 58, borderRadius: 10, overflow: 'hidden', backgroundColor: '#272727', borderWidth: s === step ? 1.5 : 1, borderColor: s === step ? '#F5F5F4' : shots[s] ? GOLD : 'rgba(255,255,255,0.3)', borderStyle: shots[s] || s === step ? 'solid' : 'dashed' }}>
              {shots[s] ? <Image source={{ uri: shots[s]!.uri }} contentFit="cover" style={{ width: '100%', height: '100%' }} accessible={false} /> : null}
            </Pressable>
          ))}
          {step && !NEED.includes(step) ? (
            <Pressable onPress={skip} accessibilityRole="button" style={{ marginLeft: 'auto', minHeight: 44, justifyContent: 'center' }}>
              <T size={14} color="#D6D3D1" style={{ textDecorationLine: 'underline' }}>
                {step === 'tag' ? 'No tag? Skip' : 'Skip'}
              </T>
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <T size={13} color="#F0B79C" lh={1.4} accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}
        {!step ? <Cta title={mode === 'store' ? 'Add to Try' : 'Save this piece'} sub={saving ? 'Uploading…' : mode === 'store' ? 'See it on you and next to your closet' : 'Then the next one'} disabled={!ready || saving} onPress={save} /> : null}
        {!step && mode === 'closet' && saved ? (
          <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center' }}>
            <T size={14} color="#D6D3D1">{`Done · ${saved} ${saved === 1 ? 'piece' : 'pieces'}`}</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
