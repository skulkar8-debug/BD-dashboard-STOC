import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'STOC | BD Dashboard',
  description: 'Weekly outbound BD performance dashboard powered by Instantly',
};

export default function BDLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
