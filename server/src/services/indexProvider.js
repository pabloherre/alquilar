import { addMonths, roundUsd, startOfMonth } from '../utils/dateMath.js';

export class ArquilerProvider {
  async getVariation({ indexType, increment }) {

    const url = `https://api.argly.com.ar/v1/${indexType.toLowerCase()}`;
    const options = {
      method: 'GET',
    };

    const response = await fetch(url, options);

    if (!response.ok) return null;
    const data = await response.json();

    let percent;

    switch (indexType) {
      case 'ICL':
      case 'CER':
      case 'UVA':
        percent = data.data.valor / increment;
        break;
      case 'IPC':
        percent = data.data.indice_ipc / increment;

        break;
      default:
        return null;
    }

    if (typeof data?.data?.valor !== 'number') return null;

    return {
      percent,
      source: 'argly_api',
      raw: data
    };
  }
}

export class FallbackProvider {
  async getVariation({ manualOverridePercent }) {
    return {
      percent: Number(manualOverridePercent || 0),
      source: 'manual_override',
      raw: null
    };
  }
}

export async function getSuggestedIncrement(contract) {
  const api = new ArquilerProvider();
  const fallback = new FallbackProvider();

  const fromDate = addMonths(contract.nextIncrementDate, -contract.incrementFrequencyMonths);
  const toDate = contract.nextIncrementDate;

  const apiResult = await api.getVariation({
    indexType: contract.indexType,
    increment: contract.incrementFrequencyMonths,
    manualOverridePercent: contract.manualOverridePercent
  });

  const chosen = apiResult || (await fallback.getVariation({ manualOverridePercent: contract.manualOverridePercent }));
  const oldAmount = Number(contract.currentAmountUsd);
  const newAmount = roundUsd(oldAmount * (1 + chosen.percent / 100));

  return {
    effectiveDate: startOfMonth(contract.nextIncrementDate),
    percent: chosen.percent,
    source: chosen.source,
    oldAmount,
    newAmount
  };
}
