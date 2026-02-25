import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { ariaLabels, keyboardKeys, announceToScreenReader } from '../../utils/accessibility';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'pie';
  data: ChartDataPoint[];
  colors?: string[];
  height?: number;
  width?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  showBrush?: boolean;
  animated?: boolean;
  interactive?: boolean;
  accessible?: boolean;
  title?: string;
  description?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  dataKey?: string;
  valueKey?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  exportable?: boolean;
}

interface EnhancedChartProps extends ChartConfig {
  onDataPointClick?: (data: ChartDataPoint, index: number) => void;
  onChartClick?: (data: any) => void;
  customTooltip?: (props: any) => React.ReactNode;
  customLegend?: (props: any) => React.ReactNode;
  className?: string;
}

export const EnhancedChart: React.FC<EnhancedChartProps> = ({
  type = 'line',
  data = [],
  colors,
  height = 400,
  width,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  showBrush = false,
  animated = true,
  interactive = true,
  accessible = true,
  title,
  description,
  xAxisLabel,
  yAxisLabel,
  dataKey = 'name',
  valueKey = 'value',
  strokeWidth = 2,
  fillOpacity = 0.6,
  exportable = false,
  onDataPointClick,
  onChartClick,
  customTooltip,
  customLegend,
  className = '',
}) => {
  const { resolvedTheme } = useTheme();
  const [selectedDataPoint, setSelectedDataPoint] = useState<ChartDataPoint | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default colors based on theme
  const defaultColors = resolvedTheme === 'dark' 
    ? ['rgb(96, 165, 250)', 'rgb(74, 222, 128)', 'rgb(251, 191, 36)', 'rgb(248, 113, 113)', 'rgb(196, 181, 253)', 'rgb(251, 146, 60)']
    : ['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)', 'rgb(139, 92, 246)', 'rgb(249, 115, 22)'];
  
  const chartColors = colors || defaultColors;

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!interactive || !accessible) return;

    switch (e.key) {
      case keyboardKeys.ENTER:
      case keyboardKeys.SPACE:
        if (selectedDataPoint) {
          const index = data.findIndex(d => d.name === selectedDataPoint.name);
          onDataPointClick?.(selectedDataPoint, index);
          announceToScreenReader(`Selected data point: ${selectedDataPoint.name}, value: ${selectedDataPoint[valueKey]}`);
        }
        break;
      
      case keyboardKeys.ARROW_RIGHT:
        if (selectedDataPoint) {
          const currentIndex = data.findIndex(d => d.name === selectedDataPoint.name);
          const nextIndex = (currentIndex + 1) % data.length;
          setSelectedDataPoint(data[nextIndex]);
          announceToScreenReader(`Moved to: ${data[nextIndex].name}, value: ${data[nextIndex][valueKey]}`);
        } else if (data.length > 0) {
          setSelectedDataPoint(data[0]);
          announceToScreenReader(`Selected: ${data[0].name}, value: ${data[0][valueKey]}`);
        }
        break;
      
      case keyboardKeys.ARROW_LEFT:
        if (selectedDataPoint) {
          const currentIndex = data.findIndex(d => d.name === selectedDataPoint.name);
          const prevIndex = currentIndex === 0 ? data.length - 1 : currentIndex - 1;
          setSelectedDataPoint(data[prevIndex]);
          announceToScreenReader(`Moved to: ${data[prevIndex].name}, value: ${data[prevIndex][valueKey]}`);
        } else if (data.length > 0) {
          setSelectedDataPoint(data[data.length - 1]);
          announceToScreenReader(`Selected: ${data[data.length - 1].name}, value: ${data[data.length - 1][valueKey]}`);
        }
        break;
      
      case keyboardKeys.ESCAPE:
        setSelectedDataPoint(null);
        announceToScreenReader('Selection cleared');
        break;
    }
  }, [interactive, accessible, selectedDataPoint, data, valueKey, onDataPointClick]);

  // Handle data point click
  const handleDataPointClick = useCallback((data: any, index: number) => {
    if (!interactive) return;
    
    setSelectedDataPoint(data);
    onDataPointClick?.(data, index);
    
    if (accessible) {
      announceToScreenReader(`Selected: ${data[dataKey]}, value: ${data[valueKey]}`);
    }
  }, [interactive, accessible, dataKey, valueKey, onDataPointClick]);

  // Handle chart export
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'csv') => {
    if (!exportable || !chartRef.current) return;

    setIsExporting(true);
    
    try {
      if (format === 'csv') {
        // Export as CSV
        const csvContent = [
          [dataKey, valueKey].join(','),
          ...data.map(d => [d[dataKey], d[valueKey]].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart-data-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'png' || format === 'svg') {
        // Export as image (would need html2canvas or similar library)
        announceToScreenReader(`Exporting chart as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      announceToScreenReader('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [exportable, data, dataKey, valueKey]);

  // Custom tooltip component
  const DefaultTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 max-w-xs">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color || chartColors[index % chartColors.length] }}
              />
              <span className="text-sm text-muted-foreground">{entry.name || valueKey}:</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Custom legend component
  const DefaultLegend = ({ payload }: any) => {
    if (!payload || !payload.length) return null;

    return (
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color || chartColors[index % chartColors.length] }}
            />
            <span className="text-sm text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 60 },
      onClick: onChartClick,
    };

    const axisProps = {
      stroke: resolvedTheme === 'dark' ? 'rgb(107, 114, 128)' : 'rgb(156, 163, 175)',
      fontSize: 12,
      tick: { fill: resolvedTheme === 'dark' ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)' },
    };

    const gridProps = {
      stroke: resolvedTheme === 'dark' ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)',
      strokeDasharray: '3 3',
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis 
              dataKey={dataKey} 
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }}
              {...axisProps}
            />
            <YAxis 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              {...axisProps}
            />
            {showTooltip && <Tooltip content={customTooltip || DefaultTooltip} />}
            {showLegend && <Legend content={customLegend || DefaultLegend} />}
            {showBrush && <Brush dataKey={dataKey} height={30} />}
            <Line 
              type="monotone" 
              dataKey={valueKey} 
              stroke={chartColors[0]} 
              strokeWidth={strokeWidth}
              dot={{ fill: chartColors[0], r: 4 }}
              activeDot={{ r: 6, onClick: handleDataPointClick }}
              animationDuration={animated ? 1000 : 0}
            />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis 
              dataKey={dataKey} 
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }}
              {...axisProps}
            />
            <YAxis 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              {...axisProps}
            />
            {showTooltip && <Tooltip content={customTooltip || DefaultTooltip} />}
            {showLegend && <Legend content={customLegend || DefaultLegend} />}
            {showBrush && <Brush dataKey={dataKey} height={30} />}
            <Bar 
              dataKey={valueKey} 
              fill={chartColors[0]}
              fillOpacity={fillOpacity}
              onClick={handleDataPointClick}
              animationDuration={animated ? 1000 : 0}
            />
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis 
              dataKey={dataKey} 
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }}
              {...axisProps}
            />
            <YAxis 
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              {...axisProps}
            />
            {showTooltip && <Tooltip content={customTooltip || DefaultTooltip} />}
            {showLegend && <Legend content={customLegend || DefaultLegend} />}
            {showBrush && <Brush dataKey={dataKey} height={30} />}
            <Area 
              type="monotone" 
              dataKey={valueKey} 
              stroke={chartColors[0]} 
              fill={chartColors[0]}
              fillOpacity={fillOpacity}
              strokeWidth={strokeWidth}
              animationDuration={animated ? 1000 : 0}
            />
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry[dataKey]}: ${entry[valueKey]}`}
              outerRadius={Math.min(height, width || 400) / 3}
              fill={chartColors[0]}
              dataKey={valueKey}
              onClick={handleDataPointClick}
              animationDuration={animated ? 1000 : 0}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={chartColors[index % chartColors.length]}
                  stroke={selectedDataPoint?.name === entry.name ? 'rgb(59, 130, 246)' : 'none'}
                  strokeWidth={selectedDataPoint?.name === entry.name ? 2 : 0}
                />
              ))}
            </Pie>
            {showTooltip && <Tooltip content={customTooltip || DefaultTooltip} />}
            {showLegend && <Legend content={customLegend || DefaultLegend} />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : -1}
      role={accessible ? 'img' : undefined}
      aria-label={accessible ? title : undefined}
      aria-describedby={accessible ? description : undefined}
    >
      {/* Chart Header */}
      {(title || description || exportable) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
          )}
          
          {/* Export Controls */}
          {exportable && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="px-3 py-1 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Export chart as CSV"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('png')}
                disabled={isExporting}
                className="px-3 py-1 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Export chart as PNG"
              >
                Export PNG
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div className="bg-card border border-border rounded-lg p-4">
        <ResponsiveContainer width={width || '100%'} height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Info */}
      {accessible && selectedDataPoint && (
        <div className="mt-2 p-2 bg-accent rounded-md">
          <p className="text-sm text-accent-foreground">
            Selected: {selectedDataPoint[dataKey]} - {selectedDataPoint[valueKey]}
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isExporting && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <div className="text-sm text-muted-foreground">Exporting...</div>
        </div>
      )}
    </div>
  );
};
