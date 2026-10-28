import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot } from 'expo-router/ui';

import { TabBar, tabItems } from '@/components/tab-bar';
import { useStore } from '@/lib/store';

export default function TabsLayout() {
  const { onboarded } = useStore();
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs>
      {/* TabSlot по умолчанию не сжимается (flexShrink 0): на вебе вкладка вырастает до высоты контента и не листается */}
      <TabSlot style={{ flexShrink: 1, flexBasis: 0 }} />
      <TabList asChild>
        <TabBar>{tabItems()}</TabBar>
      </TabList>
    </Tabs>
  );
}
