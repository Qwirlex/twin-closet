// Четыре вкладки приложения (см. PLAN.md, раздел 1). Иконки — временные из шаблона, заменим на дизайне
export const TABS = [
  { name: 'index', href: '/', label: 'Шкаф', icon: require('@/assets/images/tabIcons/home.png') },
  { name: 'me', href: '/me', label: 'Я', icon: require('@/assets/images/tabIcons/explore.png') },
  { name: 'try', href: '/try', label: 'Примерить', icon: require('@/assets/images/tabIcons/explore.png') },
  { name: 'looks', href: '/looks', label: 'Образы', icon: require('@/assets/images/tabIcons/home.png') }
] as const
