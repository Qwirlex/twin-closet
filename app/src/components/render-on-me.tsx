import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { JobSteps } from '@/components/job-steps';
import { Cta, T } from '@/components/ui';
import { ME, type Item } from '@/data/demo';
import { fileUrl, startJob, useJob } from '@/lib/api';
import { WEB_URL } from '@/lib/platform';
import { useShopping } from '@/lib/shopping';
import { useTheme } from '@/theme/theme';
import { PHOTO_BG } from '@/theme/tokens';

// Примерка по-настоящему (docs/spec-models.md, «E»): свои разобранные вещи на фото демо-человека — Muse Image одевает,
// SAM 3.1 оставляет лицо и руки настоящими, Muse Spark проверяет. Только когда у сервера есть ключ и только на сайте:
// сервер берёт фото лишь со своего адреса и с сайта приложения

/** Ассет приложения → ссылка на сайт приложения (там его возьмёт сервер) */
function siteUrl(module: unknown): string | null {
  try {
    const uri = Asset.fromModule(module as number).uri;
    const path = uri.startsWith('/') ? uri : new URL(uri).pathname;
    return path.startsWith('/assets/') ? `${WEB_URL}${path}` : null;
  } catch {
    return null;
  }
}

/** Вырезка с сервера → путь /files/…, как его понимает сервер */
const serverPath = (uri: string | undefined): string | null => {
  const i = uri?.indexOf('/files/') ?? -1;
  return uri && i >= 0 ? uri.slice(i) : null;
};

export function RenderOnMe({ pieces }: { pieces: Item[] }) {
  const { t } = useTheme();
  const { serverHasKey } = useShopping();
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { job } = useJob(jobId);

  const own = pieces.filter((p) => !p.pending && serverPath((p.image as { uri?: string }).uri)).slice(0, 4);
  if (Platform.OS !== 'web' || !serverHasKey || !own.length) return null;

  const start = async () => {
    setError(null);
    const person = siteUrl(ME.front);
    if (!person) return setError('Your photo is not available here. Open the web version to render.');
    try {
      const j = await startJob('try_on', { tryOn: { person, garments: own.map((p) => ({ label: p.name, url: serverPath((p.image as { uri?: string }).uri)! })), angle: 'front' } });
      setJobId(j.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const render = job?.status === 'done' ? job.result.render : undefined;
  return (
    <View style={{ gap: 10, padding: 14, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
      <T size={15} w={500}>
        On you, for real
      </T>
      <T size={13} color={t.muted} lh={1.45}>
        Muse Image dresses your photo in {own.length === 1 ? 'this piece' : `these ${own.length} pieces`}, SAM 3.1 keeps your face and hands real, Muse Spark checks the result.
      </T>
      {job && job.status !== 'done' ? <JobSteps job={job} /> : null}
      {render ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 360, borderRadius: 18, overflow: 'hidden', backgroundColor: PHOTO_BG }}>
            <Image source={{ uri: fileUrl(render.url) }} contentFit="contain" style={{ position: 'absolute', inset: 0 }} accessibilityLabel="You in the new pieces, rendered by Muse Image" />
          </View>
          <T size={12} color={t.muted}>
            {render.score !== null ? `Muse Spark check: ${render.score}/10${render.issue ? ` · ${render.issue}` : ''}` : 'Checked by Muse Spark'}
          </T>
        </View>
      ) : null}
      {job?.status === 'failed' || error ? (
        <T size={13} color={t.warn} lh={1.4}>
          {error ?? job?.error}
        </T>
      ) : null}
      {!job || job.status === 'done' || job.status === 'failed' ? <Cta title={render ? 'Render again' : 'Render on me · Muse Image'} sub="About a minute" grow onPress={() => void start()} /> : null}
    </View>
  );
}
