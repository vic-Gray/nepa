// Anomaly detection for predictive monitoring
import { createLogger } from '../logger/StructuredLogger';

const logger = createLogger('anomaly-detector');

interface TimeSeriesData {
  timestamp: number;
  value: number;
}

interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  threshold: number;
  message?: string;
}

export class AnomalyDetector {
  private historicalData: Map<string, TimeSeriesData[]> = new Map();
  private readonly windowSize = 100; // Number of data points to keep
  private readonly zScoreThreshold = 3; // Standard deviations for anomaly

  /**
   * Add data point for a metric
   */
  addDataPoint(metricName: string, value: number) {
    const data = this.historicalData.get(metricName) || [];
    
    data.push({
      timestamp: Date.now(),
      value,
    });

    // Keep only recent data
    if (data.length > this.windowSize) {
      data.shift();
    }

    this.historicalData.set(metricName, data);
  }

  /**
   * Calculate mean of values
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Detect anomaly using Z-score method
   */
  detectAnomaly(metricName: string, currentValue: number): AnomalyResult {
    const data = this.historicalData.get(metricName);

    if (!data || data.length < 10) {
      // Not enough data for detection
      return {
        isAnomaly: false,
        score: 0,
        threshold: this.zScoreThreshold,
      };
    }

    const values = data.map(d => d.value);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);

    if (stdDev === 0) {
      // No variation in data
      return {
        isAnomaly: false,
        score: 0,
        threshold: this.zScoreThreshold,
      };
    }

    // Calculate Z-score
    const zScore = Math.abs((currentValue - mean) / stdDev);
    const isAnomaly = zScore > this.zScoreThreshold;

    if (isAnomaly) {
      const message = currentValue > mean
        ? `Value ${currentValue.toFixed(2)} is significantly higher than average ${mean.toFixed(2)}`
        : `Value ${currentValue.toFixed(2)} is significantly lower than average ${mean.toFixed(2)}`;

      logger.warn(`Anomaly detected in ${metricName}`, {
        metric: metricName,
        currentValue,
        mean,
        stdDev,
        zScore,
        message,
      });

      return {
        isAnomaly: true,
        score: zScore,
        threshold: this.zScoreThreshold,
        message,
      };
    }

    return {
      isAnomaly: false,
      score: zScore,
      threshold: this.zScoreThreshold,
    };
  }

  /**
   * Detect trend (increasing/decreasing)
   */
  detectTrend(metricName: string): {
    trend: 'increasing' | 'decreasing' | 'stable';
    slope: number;
  } {
    const data = this.historicalData.get(metricName);

    if (!data || data.length < 10) {
      return { trend: 'stable', slope: 0 };
    }

    // Simple linear regression
    const n = data.length;
    const sumX = data.reduce((sum, d, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = data.reduce((sum, d, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return { trend, slope };
  }

  /**
   * Predict future value using simple moving average
   */
  predictNextValue(metricName: string, periodsAhead: number = 1): number | null {
    const data = this.historicalData.get(metricName);

    if (!data || data.length < 5) {
      return null;
    }

    // Use last 5 values for prediction
    const recentValues = data.slice(-5).map(d => d.value);
    const average = this.calculateMean(recentValues);

    // Simple prediction: use average of recent values
    return average;
  }

  /**
   * Monitor metric and detect anomalies automatically
   */
  monitorMetric(metricName: string, getValue: () => Promise<number>, intervalMs: number = 60000) {
    setInterval(async () => {
      try {
        const value = await getValue();
        this.addDataPoint(metricName, value);

        const anomaly = this.detectAnomaly(metricName, value);
        if (anomaly.isAnomaly) {
          logger.error(`Anomaly detected in ${metricName}`, {
            metric: metricName,
            value,
            anomaly,
          });
        }

        const trend = this.detectTrend(metricName);
        if (trend.trend !== 'stable') {
          logger.info(`Trend detected in ${metricName}`, {
            metric: metricName,
            trend: trend.trend,
            slope: trend.slope,
          });
        }
      } catch (error) {
        logger.error(`Error monitoring metric ${metricName}`, error as Error);
      }
    }, intervalMs);

    logger.info(`Started monitoring ${metricName}`, { intervalMs });
  }

  /**
   * Get historical data for a metric
   */
  getHistoricalData(metricName: string): TimeSeriesData[] {
    return this.historicalData.get(metricName) || [];
  }

  /**
   * Clear historical data
   */
  clearData(metricName?: string) {
    if (metricName) {
      this.historicalData.delete(metricName);
    } else {
      this.historicalData.clear();
    }
  }
}

export default new AnomalyDetector();
