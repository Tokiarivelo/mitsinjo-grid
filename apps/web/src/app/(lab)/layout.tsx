import type { ReactNode } from 'react';

export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#080D1A] text-slate-100">
      <main className="flex-1">{children}</main>
    </div>
  );
}
