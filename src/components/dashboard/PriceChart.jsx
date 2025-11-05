import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function PriceChart({ data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Trends & Optimization</CardTitle>
        <CardDescription>
          Current prices and optimal price points over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value) => [`$${value}`, '']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--chart-1)"
              strokeWidth={2}
              name="Current Price"
              dot={{ fill: 'var(--chart-1)' }}
            />
            <Line
              type="monotone"
              dataKey="optimal"
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Optimal Price"
              dot={{ fill: 'var(--chart-2)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
