// components/BreakevenChart.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/global';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;
const chartHeight = 200;
const X_LABEL_H = 36;           // height for the labels BELOW the axis
const TIME_ZONE = 'Asia/Manila';
const Y_AXIS_W = 44;            // left axis width (kept compact)

function formatPeso(n) {
  const num = Number(n || 0);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// short y-axis labels (₱12k / ₱1.2M)
function formatAxisLabel(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `₱${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `₱${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `₱${Math.round(v)}`;
}

function formatPeriodLabel(item, timeZone = TIME_ZONE) {
  const start = new Date(item.period_start);
  const end = item.period_end ? new Date(item.period_end) : null;

  if (item.period_type === 'daily') {
    return start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone });
  }
  if (item.period_type === 'weekly') {
    // Ensure week starts Monday and ends Sunday
    const monday = new Date(start);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + daysToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const s = monday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone });
    const e = sunday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone });
    return `${s}–${e}`;
  }
  if (item.period_type === 'monthly') {
    return start.toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone });
  }
  return 'Unknown';
}

// Round up to a "nice" chart max (1/2/5 * 10^n).
function niceCeil(n, isDailyData = false) {
  const x = Math.max(0, Number(n) || 0);
  if (x === 0) return 100;

  if (isDailyData) return Math.ceil(x / 100) * 100;

  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const fraction = x / base;
  let niceFrac;
  if (fraction <= 1) niceFrac = 1;
  else if (fraction <= 2) niceFrac = 2;
  else if (fraction <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

export default function BreakevenChart({ data = [], currentData = null, timeZone = TIME_ZONE, frequency = 'Daily', onExportPDF }) {
  // Merge + sort + de-dup (currentData overrides same period)
  const series = useMemo(() => {
    const map = new Map();
    const push = (item) => {
      if (!item) return;
      const key = `${item.period_type}|${new Date(item.period_start).toISOString()}`;
      map.set(key, item);
    };
    (data || []).forEach(push);
    if (currentData) push(currentData);

    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(a.period_start) - new Date(b.period_start));
    return arr;
  }, [data, currentData]);

  if (!series || series.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available for chart</Text>
      </View>
    );
  }

  // Max across earnings/expenses; make it "nice"
  const rawMax = Math.max(
    ...series.map((item) => Math.max(Number(item.revenue_driver) || 0, Number(item.expenses) || 0))
  );
  const isDailyData = series.some(item => item.period_type === 'daily');
  const chartMax = Math.max(1, niceCeil(rawMax, isDailyData));

  // y-ticks bottom→top (0 to max)
  const tickRatios = [0, 0.25, 0.5, 0.75, 1];

  // Layout
  const visibleSlots = Math.min(series.length, 6);
  const plotW = chartWidth - Y_AXIS_W;
  const groupWidth = Math.max(72, Math.floor(plotW / visibleSlots));
  const barWidth = Math.max(18, Math.floor(groupWidth * 0.32));
  const barGap = Math.max(4, Math.floor(groupWidth * 0.06));
  const contentWidth = series.length * groupWidth + 16;
  const finalPlotW = Math.max(plotW, contentWidth);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Breakeven Report — Earnings vs Expenses</Text>
        <TouchableOpacity style={styles.pdfButton} onPress={onExportPDF}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.chartRow, { height: chartHeight + X_LABEL_H }]}>
        {/* Y Axis */}
        <View style={[styles.yAxis, { width: Y_AXIS_W, marginBottom: X_LABEL_H, position: 'relative' }]}>
          {tickRatios.map((r) => (
            <View
              key={`label-${r}`}
              style={[
                styles.yAxisLabelContainer,
                { position: 'absolute', right: 2, bottom: r * chartHeight }
              ]}
            >
              <Text style={styles.yAxisLabel}>{formatAxisLabel(Math.round(chartMax * r))}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable plot + labels below */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.plotContent, { width: finalPlotW }]}
        >
          <View style={{ width: finalPlotW }}>
            {/* Plot area (with x-axis line at bottom) */}
            <View style={[styles.plotArea, { width: finalPlotW, height: chartHeight }]}>
              {/* Gridlines */}
              {tickRatios
                .filter((r) => r !== 0) // bottom border already drawn
                .map((r) => (
                  <View
                    key={`grid-${r}`}
                    style={[styles.gridLine, { bottom: r * chartHeight, width: finalPlotW }]}
                  />
                ))}

              {/* Bars */}
              <View style={[styles.barsContainer, { height: chartHeight }]}>
                {series.map((item, idx) => {
                  const earnings = Number(item.revenue_driver) || 0;
                  const expenses = Number(item.expenses) || 0;
                  const earningsHeight = (earnings / chartMax) * chartHeight;
                  const expensesHeight = (expenses / chartMax) * chartHeight;
                  const isCurrent = currentData && idx === series.length - 1;

                  const showEarnVal = earningsHeight > 18;
                  const showExpVal = expensesHeight > 18;

                  return (
                    <View key={idx} style={[styles.barGroup, { width: groupWidth }]}>
                      <View style={[styles.bars, { gap: barGap }]}>
                        {/* Earnings */}
                        <View style={styles.barContainer}>
                          {showEarnVal ? <Text style={styles.barValue}>{formatPeso(earnings)}</Text> : null}
                          <View
                            style={[
                              styles.bar,
                              {
                                height: earningsHeight,
                                backgroundColor: '#A65A58',
                                width: barWidth,
                                opacity: isCurrent ? 0.85 : 1,
                              },
                            ]}
                          />
                        </View>

                        {/* Expenses */}
                        <View style={styles.barContainer}>
                          {showExpVal ? <Text style={styles.barValue}>{formatPeso(expenses)}</Text> : null}
                          <View
                            style={[
                              styles.bar,
                              {
                                height: expensesHeight,
                                backgroundColor: '#ff7b7b',
                                width: barWidth,
                                opacity: isCurrent ? 0.85 : 1,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* X-axis labels BELOW the axis line */}
            <View style={[styles.xLabelsStrip, { width: finalPlotW, height: X_LABEL_H }]}>
              {series.map((item, idx) => {
                const isCurrent = currentData && idx === series.length - 1;
                const isCurrentPeriod = (() => {
                  if (!item.period_start) return false;
                  const now = new Date();
                  const itemStart = new Date(item.period_start);
                  
                  if (item.period_type === 'monthly') {
                    return now.getFullYear() === itemStart.getFullYear() && now.getMonth() === itemStart.getMonth();
                  }
                  if (item.period_type === 'weekly') {
                    const currentWeekStart = new Date(now);
                    const dayOfWeek = currentWeekStart.getDay();
                    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
                    currentWeekStart.setHours(0, 0, 0, 0);
                    
                    const itemWeekStart = new Date(itemStart);
                    const itemDayOfWeek = itemWeekStart.getDay();
                    const itemDaysToMonday = itemDayOfWeek === 0 ? -6 : 1 - itemDayOfWeek;
                    itemWeekStart.setDate(itemWeekStart.getDate() + itemDaysToMonday);
                    itemWeekStart.setHours(0, 0, 0, 0);
                    
                    return currentWeekStart.getTime() === itemWeekStart.getTime();
                  }
                  return false;
                })();
                
                return (
                  <View key={`xlabel-${idx}`} style={[styles.xLabelCell, { width: groupWidth }]}>
                    <Text style={[styles.xAxisLabel, (isCurrent || isCurrentPeriod) && styles.currentLabel]} numberOfLines={2}>
                      {formatPeriodLabel(item, timeZone)}
                      {isCurrentPeriod ? ' (Current)' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#A65A58' }]} />
          <Text style={styles.legendText}>Earnings</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#ff7b7b' }]} />
          <Text style={styles.legendText}>Expenses</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 32,
  },
  pdfButton: {
    position: 'absolute',
    right: 0,
    top: -2,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  chartRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  /* Y axis */
  yAxis: {
    height: chartHeight,
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  yAxisLabelContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'right',
    fontWeight: '600',
    lineHeight: 9,
    marginRight: 8,
  },

  /* Plot area */
  plotContent: {
    paddingRight: 8,
  },
  plotArea: {
    borderLeftWidth: 1,
    borderBottomWidth: 1, // ← x-axis line
    borderColor: '#E0E0E0',
    position: 'relative',
    paddingHorizontal: 8,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: '#EFEFEF',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
  },
  barGroup: {
    alignItems: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: chartHeight,
    justifyContent: 'center',
  },
  barContainer: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 3,
    minHeight: 0,
  },
  barValue: {
    fontSize: 8,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
    maxWidth: 60,
  },

  /* X labels BELOW the axis */
  xLabelsStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  xLabelCell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  xAxisLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    width: '100%',
    fontWeight: '500',
  },
  currentLabel: {
    color: colors.primary,
    fontWeight: '700',
  },

  /* Legend + empty */
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textSecondary,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 20,
    marginVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
