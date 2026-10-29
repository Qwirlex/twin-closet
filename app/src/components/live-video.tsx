import { useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Glass, T } from '@/components/ui';
import { openCamera, setVoice, stopCamera, voiceOn } from '@/lib/live-camera';
import { PHOTO_GLASS } from '@/theme/tokens';

// Живая камера умного скана (только веб): <video> на весь экран, поток включается, пока экран активен

export type CameraState = 'starting' | 'live' | 'error';

export function useLiveCamera(facing: 'user' | 'environment', active: boolean): { video: RefObject<HTMLVideoElement | null>; state: CameraState; error: string | null; landscape: boolean } {
  const video = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [error, setError] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const el = video.current;
    openCamera(facing)
      .then((s) => {
        if (stopped) return stopCamera(s);
        stream = s;
        const v = el ?? video.current;
        if (!v) return;
        v.srcObject = s;
        v.onloadeddata = () => {
          setLandscape(v.videoWidth > v.videoHeight);
          setState('live');
        };
        void v.play().catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (stopped) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      });
    return () => {
      stopped = true;
      stopCamera(stream);
      if (el) el.srcObject = null;
    };
  }, [facing, active]);

  return { video, state, error, landscape };
}

/**
 * Видео камеры. Фронтальная — зеркалом, как в зеркале. Портретный поток телефона заполняет экран;
 * горизонтальный поток ноутбука показываем целиком, чтобы голова и ноги на экране совпадали с проверкой
 */
export function LiveVideo({ video, mirror, landscape }: { video: RefObject<HTMLVideoElement | null>; mirror: boolean; landscape: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0B0B0C' }}>
      <video ref={video} playsInline muted autoPlay aria-label="Live camera" style={{ width: '100%', height: '100%', objectFit: landscape ? 'contain' : 'cover', transform: mirror ? 'scaleX(-1)' : undefined }} />
    </View>
  );
}

/** Голос вкл/выкл — на самом экране скана */
export function VoiceToggle() {
  const [on, setOn] = useState(voiceOn);
  return (
    <Pressable
      onPress={() => {
        setVoice(!on);
        setOn(!on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Voice guide">
      <Glass variant="photo" style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={on ? 'sound' : 'mute'} size={18} color={on ? '#C8B68A' : PHOTO_GLASS.text} stroke={1.8} />
        <T size={13} color={PHOTO_GLASS.text}>
          {on ? 'Voice on' : 'Voice off'}
        </T>
      </Glass>
    </Pressable>
  );
}
