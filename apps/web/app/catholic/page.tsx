import type { Metadata } from 'next';
import CatholicWorld from '@/components/CatholicWorld';

export const metadata: Metadata = {
  title: '고요한 성당 | Religion',
  description: '성가가 흐르는 온라인 성당. 초를 봉헌하고 묵주기도를 바치며 마음을 내려놓는 3D 공간.',
};

export default function CatholicPage() {
  return <CatholicWorld />;
}
