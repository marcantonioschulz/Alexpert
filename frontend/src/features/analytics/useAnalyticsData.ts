import { useCallback, useEffect, useState } from 'react';
import { API_HEADERS, type ApiResponse } from '../../utils/api';
import type {
  AnalyticsSummary,
  AnalyticsTrendPoint,
  ScoreDistributionPoint
} from './types';

type AnalyticsState = {
  summary: AnalyticsSummary | null;
  trend: AnalyticsTrendPoint[];
  distribution: ScoreDistributionPoint[];
  loading: boolean;
  error: string | null;
};

const initialState: AnalyticsState = {
  summary: null,
  trend: [],
  distribution: [],
  loading: true,
  error: null
};

export function useAnalyticsData(days = 14) {
  const [state, setState] = useState<AnalyticsState>(initialState);

  const fetchData = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const [summaryResponse, trendResponse, distributionResponse] = await Promise.all([
        fetch('/api/analytics/summary', {
          headers: {
            ...(API_HEADERS ?? {})
          }
        }),
        fetch(`/api/analytics/trends?days=${days}`, {
          headers: {
            ...(API_HEADERS ?? {})
          }
        }),
        fetch('/api/analytics/score-distribution', {
          headers: {
            ...(API_HEADERS ?? {})
          }
        })
      ]);

      if (!summaryResponse.ok || !trendResponse.ok || !distributionResponse.ok) {
        throw new Error('Analytics-Daten konnten nicht geladen werden.');
      }

      const [summaryPayload, trendPayload, distributionPayload] = await Promise.all([
        summaryResponse.json() as Promise<ApiResponse<AnalyticsSummary>>,
        trendResponse.json() as Promise<ApiResponse<AnalyticsTrendPoint[]>>,
        distributionResponse.json() as Promise<ApiResponse<ScoreDistributionPoint[]>>
      ]);

      if (!summaryPayload.success || !trendPayload.success || !distributionPayload.success) {
        throw new Error('Analytics-Daten konnten nicht geladen werden.');
      }

      setState({
        summary: summaryPayload.data,
        trend: trendPayload.data,
        distribution: distributionPayload.data,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error(error);
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      }));
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refresh: fetchData
  };
}
