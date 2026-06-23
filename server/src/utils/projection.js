import dayjs from 'dayjs';
import { addMonths, roundUsd, startOfMonth } from './dateMath.js';

export function buildProjectionFromHistoryWithEstimates(contract, estimatedPercent) {
  const points = [];

  points.push({
    date: dayjs(startOfMonth(contract.startDate)).format('YYYY-MM-DD'),
    amountUsd: roundUsd(Number(contract.baseAmountUsd)),
    event: 'start'
  });

  const sortedHistory = [...(contract.incrementHistory || [])].sort(
    (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
  );

  for (const event of sortedHistory) {
    points.push({
      date: dayjs(event.effectiveDate).format('YYYY-MM-DD'),
      amountUsd: roundUsd(Number(event.newAmount)),
      event: event.source || 'confirmed_increment'
    });
  }

  const end = dayjs(contract.expirationDate);
  let cursor = startOfMonth(contract.nextIncrementDate);
  let amount = roundUsd(Number(contract.currentAmountUsd));
  let firstEstimated = true;

  while (dayjs(cursor).isBefore(end) || dayjs(cursor).isSame(end, 'day')) {
    if (firstEstimated && contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined) {
      amount = roundUsd(Number(contract.manualNextAmountUsd));
    } else {
      amount = roundUsd(amount * (1 + Number(estimatedPercent) / 100));
    }

    points.push({
      date: dayjs(cursor).format('YYYY-MM-DD'),
      amountUsd: amount,
      event: firstEstimated && contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined
        ? 'estimated_manual_next'
        : 'estimated_increment'
    });

    firstEstimated = false;
    cursor = addMonths(cursor, Number(contract.incrementFrequencyMonths));
  }

  return points;
}