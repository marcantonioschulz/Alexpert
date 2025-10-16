import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAnalyticsData } from './useAnalyticsData';
import styles from './AnalyticsDashboard.module.css';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit'
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('de-DE', DATE_FORMAT);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Keine Daten';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Keine Daten';
  }

  return date.toLocaleString('de-DE');
}

export function AnalyticsDashboard() {
  const { summary, trend, distribution, loading, error, refresh } = useAnalyticsData();

  const hasTrendData = trend.length > 0;
  const hasDistributionData = distribution.some((bucket) => bucket.count > 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Gesprächs-Analytics</h2>
        <button type="button" className={styles.refreshButton} onClick={refresh}>
          Daten aktualisieren
        </button>
      </div>

      {loading && <p className={styles.loading}>Lade Analytics...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && summary && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryTitle}>Gesamtgespräche</p>
              <span className={styles.summaryValue}>{summary.totalConversations}</span>
              <span className={styles.summaryMeta}>
                {summary.lastSevenDays} in den letzten 7 Tagen
              </span>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryTitle}>Bewertete Gespräche</p>
              <span className={styles.summaryValue}>{summary.scoredConversations}</span>
              <span className={styles.summaryMeta}>
                Aktualisiert: {formatTimestamp(summary.lastConversationAt)}
              </span>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryTitle}>Ø Score</p>
              <span className={styles.summaryValue}>
                {summary.averageScore !== null ? summary.averageScore.toFixed(2) : '–'}
              </span>
              <span className={styles.summaryMeta}>
                Top Score: {summary.bestScore ? summary.bestScore.score : '–'}
              </span>
            </div>

            <div className={styles.summaryCard}>
              <p className={styles.summaryTitle}>Niedrigster Score</p>
              <span className={styles.summaryValue}>
                {summary.lowestScore ? summary.lowestScore.score : '–'}
              </span>
              <span className={styles.summaryMeta}>
                Gespräch-ID: {summary.lowestScore ? summary.lowestScore.conversationId : '–'}
              </span>
            </div>
          </div>

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Gespräche & Score-Trend</h3>
              <div className={styles.chartWrapper}>
                {hasTrendData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis yAxisId="count" allowDecimals={false} width={40} />
                      <YAxis yAxisId="score" orientation="right" domain={[0, 100]} width={40} />
                      <Tooltip
                        formatter={(value: number | null, name) => {
                          if (value === null) {
                            return ['–', name];
                          }
                          if (name === 'Ø Score') {
                            return [`${value.toFixed(2)}`, name];
                          }
                          return [value, name];
                        }}
                        labelFormatter={formatDateLabel}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="conversations"
                        name="Gespräche"
                        stroke="#2563eb"
                        strokeWidth={2}
                        yAxisId="count"
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageScore"
                        name="Ø Score"
                        stroke="#f97316"
                        strokeWidth={2}
                        yAxisId="score"
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.loading}>Noch keine Trenddaten verfügbar.</p>
                )}
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Score-Verteilung</h3>
              <div className={styles.chartWrapper}>
                {hasDistributionData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} width={40} />
                      <Tooltip labelStyle={{ fontWeight: 600 }} />
                      <Bar dataKey="count" name="Gespräche" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.loading}>Noch keine Score-Daten verfügbar.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
