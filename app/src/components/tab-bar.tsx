import { router } from 'expo-router';
import { TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { TAB_BAR_HEIGHT, useTabBarBottom } from '@/components/layout';
import { Glass, T } from '@/components/ui';
import { useTheme } from '@/theme/theme';

// Нижнее меню: Closet · Looks · [Try on] · Scan · Me. Scan открывает камеру на весь экран, поэтому это не вкладка

export function TabBar(props: TabListProps) {
  const { t } = useTheme();
  const bottom = useTabBarBottom();
  return (
    <View {...props} style={{ position: 'absolute', left: 14, right: 14, bottom, height: TAB_BAR_HEIGHT }} accessibilityRole="tablist">
      <Glass tokens={t.bar} radius={34} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, overflow: 'visible' }}>
        {props.children}
      </Glass>
    </View>
  );
}

/** Вкладки внутри TabList — прямые дети (вызывать функцией, не компонентом), иначе expo-router их не найдёт */
export function tabItems() {
  return [
    <TabTrigger key="index" name="index" href="/" asChild>
      <TabItem icon="closet" label="Closet" />
    </TabTrigger>,
    <TabTrigger key="looks" name="looks" href="/looks" asChild>
      <TabItem icon="looks" label="Looks" />
    </TabTrigger>,
    <TabTrigger key="try" name="try" href="/try" asChild>
      <CenterItem />
    </TabTrigger>,
    <ScanItem key="scan" />,
    <TabTrigger key="me" name="me" href="/me" asChild>
      <TabItem icon="me" label="Me" />
    </TabTrigger>,
  ];
}

function ItemBody({ icon, label, on }: { icon: IconName; label: string; on: boolean }) {
  const { t } = useTheme();
  return (
    <>
      <Icon name={icon} size={22} color={on ? t.text : t.muted} />
      <T size={11} w={on ? 600 : 400} color={on ? t.text : t.muted}>
        {label}
      </T>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? t.accent : 'transparent' }} />
    </>
  );
}

const itemStyle = { minWidth: 58, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 } as const;

function TabItem({ icon, label, isFocused, ref: _ref, ...props }: TabTriggerSlotProps & { icon: IconName; label: string }) {
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: !!isFocused }} style={itemStyle}>
      <ItemBody icon={icon} label={label} on={!!isFocused} />
    </Pressable>
  );
}

function ScanItem() {
  return (
    <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" accessibilityLabel="Scan" style={itemStyle}>
      <ItemBody icon="scan" label="Scan" on={false} />
    </Pressable>
  );
}

/** Центр — круг 62px, приподнят на 26px, вырез цветом фона; на экране примерки ещё кольцо accent */
function CenterItem({ isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  const { t } = useTheme();
  const ring = `0 0 0 5px ${t.bg}` + (isFocused ? `, 0 0 0 6.5px ${t.accent}` : '') + `, ${t.fabShadow}`;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel="Try on" accessibilityState={{ selected: !!isFocused }} style={{ width: 70, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9 }}>
      <View style={{ position: 'absolute', top: -26, width: 62, height: 62, borderRadius: 31, backgroundColor: t.ctaBg, alignItems: 'center', justifyContent: 'center', boxShadow: ring }}>
        <Icon name="tryOn" size={26} color={t.ctaText} />
      </View>
      <T size={11} w={600}>
        Try on
      </T>
    </Pressable>
  );
}
