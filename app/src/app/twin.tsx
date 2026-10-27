import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Glass, GlassButton, GoldRim, Label, Orb, T, Tag } from '@/components/ui';
import { LOOKS, type DemoLook, type Pic } from '@/data/demo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT, PHOTO_BG, RECORD_RED } from '@/theme/tokens';

// Twin — ИИ-стилист. Настоящие ответы даст Muse Spark с инструментами (шкаф, образы, примерка),
// голос — Muse Voice Transcribe. Пока ключа Meta нет, отвечает заготовками на подсказки.

interface Message {
  id: number;
  from: 'me' | 'twin';
  text?: string;
  image?: Pic;
  look?: string;
}

const CHIPS = ['Dinner on Friday', 'Find it in Zara', 'Weekend plans', 'Evening out', 'How do I scan?'];

const LOOK_REPLIES: { match: RegExp; look: string; text: string }[] = [
  { match: /dinner|date|friday|work|office/i, look: 'office', text: 'Smart but relaxed: the wide-leg jeans you are eyeing with your grey tee and Chelsea boots.' },
  { match: /weekend|walk|casual|trip/i, look: 'weekend', text: 'Both new pieces with your white sneakers. Easy, and warm enough for a walk.' },
  { match: /evening|party|night|bar|out/i, look: 'evening', text: 'The olive bomber over your black jeans, with white sneakers to keep it light.' },
];

const SCAN_HELP =
  'Two scans and you are set. For you: prop the phone up, step back until your feet are in frame and turn slowly for six seconds. For your closet: film along the rail for about 30 seconds, or hold pieces up one by one. Shoes too.';
const OFFLINE = 'I answer free questions once the Meta key is connected. For now, pick one of the ideas below.';
const BARS = [8, 14, 20, 12, 24, 18, 10, 22, 28, 16, 12, 20, 26, 14, 8, 18, 24, 12, 20, 10, 16, 22, 12, 8];

const STORE_SEARCH =
  'Once the Meta key is connected I search Zara, Bershka and Pull & Bear for you with Muse Spark web search: a piece that completes your look, at the price in your country. Anything you like goes to your wishlist, and I tell you when it gets cheaper. Other shops are coming soon.';

function replyTo(text: string): Message[] {
  if (/scan|camera|film/i.test(text)) return [{ id: 0, from: 'twin', text: SCAN_HELP }];
  if (/zara|bershka|pull|store|shop|buy|find/i.test(text)) return [{ id: 0, from: 'twin', text: STORE_SEARCH }];
  const hit = LOOK_REPLIES.find((r) => r.match.test(text));
  if (!hit) return [{ id: 0, from: 'twin', text: OFFLINE }];
  return [
    { id: 0, from: 'twin', text: hit.text },
    { id: 0, from: 'twin', look: hit.look },
  ];
}

export default function TwinScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { importAsset } = useStore();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'twin', text: 'Hi, I know your closet and the pieces you are eyeing. Tell me the plan and I will put an outfit together.' }]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setTick((n) => n + 1), 140);
    return () => clearInterval(id);
  }, [listening]);

  const push = (...list: Message[]) => setMessages((m) => [...m, ...list.map((x) => ({ ...x, id: nextId.current++ }))]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setDraft('');
    push({ id: 0, from: 'me', text: clean }, ...replyTo(clean));
  };

  const another = (current: string) => {
    const i = LOOKS.findIndex((l) => l.id === current);
    const next = LOOKS[(i + 1) % LOOKS.length];
    push({ id: 0, from: 'twin', text: `Another idea: ${next.note.charAt(0).toLowerCase()}${next.note.slice(1)}` }, { id: 0, from: 'twin', look: next.id });
  };

  const attach = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    importAsset(res.assets[0], 'Screenshot');
    push({ id: 0, from: 'me', image: { uri: res.assets[0].uri } }, { id: 0, from: 'twin', text: 'Added it to your try-on. Open Try on to see it being cut out and read.' });
  };

  const toggleMic = () => {
    if (listening) push({ id: 0, from: 'twin', text: 'Voice input runs on Muse Voice Transcribe once the Meta key is connected.' });
    setTick(0);
    setListening(!listening);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: t.line }}>
        <GlassButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Orb size={34} />
          <View>
            <T size={17} w={500} accessibilityRole="header">
              Twin
            </T>
            <T size={12} color={t.muted}>
              Your stylist · Muse Spark
            </T>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 14 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <Label style={{ alignSelf: 'center', marginTop: 6 }}>Demo replies until the Meta key is connected</Label>
        {messages.map((m) =>
          m.look ? (
            <LookCard key={m.id} look={LOOKS.find((l) => l.id === m.look)!} onAnother={() => another(m.look!)} />
          ) : m.from === 'me' ? (
            <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: 270, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: t.surface2 }}>
              {m.image ? <Image source={m.image} contentFit="cover" style={{ width: 160, height: 200, borderRadius: 12 }} accessibilityLabel="Your photo" /> : <T lh={1.4}>{m.text}</T>}
            </View>
          ) : (
            <T key={m.id} lh={1.5} style={{ maxWidth: 320 }}>
              {m.text}
            </T>
          )
        )}
      </ScrollView>

      <View style={{ paddingTop: 10, paddingBottom: insets.bottom + 16, gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} accessibilityLabel="Suggestions">
          {CHIPS.map((c) => (
            <Pressable key={c} onPress={() => send(c)} accessibilityRole="button">
              <Glass style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
                <T size={13} color={t.glass.text}>
                  {c}
                </T>
              </Glass>
            </Pressable>
          ))}
        </ScrollView>
        <Glass radius={30} style={{ marginHorizontal: 16, minHeight: 60, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={attach} accessibilityRole="button" accessibilityLabel="Add a photo" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={20} color={t.muted} />
          </Pressable>
          {listening ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="Listening" accessibilityLiveRegion="polite">
              <View style={{ flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 3, overflow: 'hidden' }}>
                {BARS.map((h, i) => (
                  <View key={i} style={{ width: 3, borderRadius: 2, backgroundColor: t.accent, height: Math.max(4, ((h + ((tick * 7 + i * 5) % 17)) % 28) + 2) }} />
                ))}
              </View>
              <T size={13} color={t.muted} style={{ fontVariant: ['tabular-nums'] }}>
                00:{String(Math.floor(tick / 7)).padStart(2, '0')}
              </T>
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send(draft)}
              placeholder="Ask Twin anything…"
              placeholderTextColor={t.muted}
              returnKeyType="send"
              accessibilityLabel="Message Twin"
              style={{ flex: 1, minWidth: 0, height: 44, fontFamily: FONT[400], fontSize: 15, color: t.text, outlineStyle: 'none' } as never}
            />
          )}
          {draft.trim() && !listening ? (
            <Pressable onPress={() => send(draft)} accessibilityRole="button" accessibilityLabel="Send" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.ctaBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={20} color={t.ctaText} stroke={1.8} />
            </Pressable>
          ) : (
            <Pressable onPress={toggleMic} accessibilityRole="button" accessibilityLabel={listening ? 'Stop voice input' : 'Speak to Twin'} accessibilityState={{ selected: listening }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: listening ? RECORD_RED : t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={listening ? 'stop' : 'mic'} size={20} color={listening ? '#FFFFFF' : t.onAccent} stroke={1.8} />
            </Pressable>
          )}
        </Glass>
      </View>
    </KeyboardAvoidingView>
  );
}

function LookCard({ look, onAnother }: { look: DemoLook; onAnother: () => void }) {
  const { t } = useTheme();
  const { item } = useStore();
  return (
    <GoldRim style={{ flexDirection: 'row', gap: 12, paddingTop: 9, paddingBottom: 11, paddingLeft: 9, paddingRight: 11, maxWidth: 340 }}>
      <View style={{ width: 100, minHeight: 160, borderRadius: 16, backgroundColor: PHOTO_BG, overflow: 'hidden' }}>
        <Image source={look.renders.front} contentFit="cover" contentPosition={{ top: '18%', left: '50%' }} style={{ position: 'absolute', inset: 0 }} accessibilityLabel={`You in the suggested outfit: ${look.title}`} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <T size={15} w={500}>
          {look.title}
        </T>
        {look.itemIds.map((id) => {
          const it = item(id);
          if (!it) return null;
          return (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <T size={13} numberOfLines={1} style={{ flexShrink: 1 }}>
                {it.name}
              </T>
              <Tag kind={it.via ? 'new' : 'yours'} />
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <Pressable onPress={() => router.push({ pathname: '/result', params: { look: look.id } })} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.ctaBg, justifyContent: 'center' }}>
            <T size={13} w={500} color={t.ctaText}>
              Try it on
            </T>
          </Pressable>
          <Pressable onPress={onAnother} accessibilityRole="button">
            <Glass style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
              <T size={13} color={t.glass.text}>
                Another idea
              </T>
            </Glass>
          </Pressable>
        </View>
      </View>
    </GoldRim>
  );
}
