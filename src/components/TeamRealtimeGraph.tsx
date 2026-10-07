"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

interface TeamRealtimeGraphProps {
  currentTotal: number;
  fundingAsk: number;
  color?: string;
  height?: number;
}

export function TeamRealtimeGraph({
  currentTotal,
  fundingAsk,
  color = "#00e599",
  height = 50,
}: TeamRealtimeGraphProps) {
  // Generate realistic sparkline growth curve leading to the currentTotal
  const pointsCount = 7;
  const data = React.useMemo(() => {
    if (currentTotal <= 0) {
      return Array.from({ length: pointsCount }, (_, i) => ({ val: 0 }));
    }

    const curve: { val: number }[] = [];
    for (let i = 0; i < pointsCount - 1; i++) {
      // Exponential ramp up curve
      const factor = Math.pow(i / (pointsCount - 1), 1.6);
      const jitter = (Math.sin(i * 1.5) * 0.05 + 1);
      curve.push({
        val: Math.max(0, Math.round(currentTotal * factor * jitter)),
      });
    }
    curve.push({ val: currentTotal });
    return curve;
  }, [currentTotal]);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, Math.max(fundingAsk, currentTotal * 1.1)]} />
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#grad-${color.replace("#", "")})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
