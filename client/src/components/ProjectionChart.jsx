import dayjs from 'dayjs';
import { Paper, Stack, Typography, Chip } from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { formatCompactMoney, formatDateDisplay } from '../utils/formatters';

export default function ProjectionChart({ data, currentPeriodStart, currentPeriodEnd, periodMonths }) {
  const chartData = (data || []).map((point) => ({
    ...point,
    ts: dayjs(point.date).valueOf()
  }));

  const periodStartTs = currentPeriodStart ? dayjs(currentPeriodStart).valueOf() : null;
  const periodEndTs = currentPeriodEnd ? dayjs(currentPeriodEnd).valueOf() : null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, px: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">Evolucion de cuota</Typography>
        {currentPeriodStart && currentPeriodEnd && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`Periodo actual: ${periodMonths} meses`}
          />
        )}
      </Stack>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="ts"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => formatDateDisplay(dayjs(value).format('YYYY-MM-DD'))}
            />
            <YAxis tickFormatter={(value) => formatCompactMoney(value)} />

            {periodStartTs && (
              <ReferenceLine x={periodStartTs} stroke="#0284c7" strokeWidth={2} strokeDasharray="6 4" />
            )}
            {periodEndTs && (
              <ReferenceLine x={periodEndTs} stroke="#0284c7" strokeWidth={2} strokeDasharray="6 4" />
            )}

            <Tooltip
              labelFormatter={(value) => formatDateDisplay(dayjs(value).format('YYYY-MM-DD'))}
              formatter={(value) => [formatCompactMoney(value), 'Cuota']}
            />
            <Line
              type="stepAfter"
              dataKey="amountUsd"
              stroke="#0f766e"
              strokeWidth={4}
              dot={{ r: 3, strokeWidth: 0, fill: '#0f766e' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}
