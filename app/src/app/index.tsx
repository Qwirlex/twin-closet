import { useEffect, useState } from 'react';

import { ScreenStub } from '@/components/screen-stub';
import { ThemedText } from '@/components/themed-text';
import { API_URL, health } from '@/lib/api';

export default function ClosetScreen() {
  const [status, setStatus] = useState('проверяю сервер…');

  useEffect(() => {
    health()
      .then((h) => setStatus(h.meta ? 'сервер на связи, ключ Meta есть' : 'сервер на связи, ключа Meta пока нет'))
      .catch(() => setStatus(`нет связи с ${API_URL}`));
  }, []);

  return (
    <ScreenStub title="Шкаф" lead="Сними шкаф на видео или покажи вещи по одной — здесь появятся все твои вещи без фона.">
      <ThemedText type="small" themeColor="textSecondary">
        {status}
      </ThemedText>
    </ScreenStub>
  );
}
