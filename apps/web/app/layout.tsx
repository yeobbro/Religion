import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Religion | 함께 머무는 기도의 공간',
  description: '본당 공동체가 함께 기도하고 마음을 나누는 온라인 성당 공간',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
