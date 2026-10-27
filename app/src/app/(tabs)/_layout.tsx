import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot } from 'expo-router/ui';

import { TabBar, tabItems } from '@/components/tab-bar';
import { useStore } from '@/lib/store';

export default function TabsLayout() {
  const { onboarded } = useStore();
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBar>{tabItems()}</TabBar>
      </TabList>
    </Tabs>
  );
}
