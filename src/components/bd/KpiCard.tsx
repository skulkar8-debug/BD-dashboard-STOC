import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  title: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
  warn?: boolean;
};

export function KpiCard({ title, value, sub, accent, icon, warn }: Props) {
  return (
    <Card
      className="shadow-sm"
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div
          className={`text-2xl font-bold ${warn ? 'text-red-600' : 'text-gray-900'}`}
        >
          {value}
        </div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}
