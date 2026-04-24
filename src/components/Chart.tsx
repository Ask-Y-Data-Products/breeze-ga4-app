import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

const PALETTE = ['#3b5bdb', '#0ea5e9', '#059669', '#d97706', '#db2777', '#7c3aed', '#eab308', '#14b8a6'];

const AXIS_COLOR = '#cfd4dc';
const AXIS_LABEL = '#5c6473';
const GRID_COLOR = '#eef0f3';
const TEXT_COLOR = '#1a1f29';

const BASE = {
  textStyle: { fontFamily: 'inherit', color: TEXT_COLOR },
  grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: false },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: '#cfd4dc',
    borderWidth: 1,
    textStyle: { color: TEXT_COLOR, fontFamily: 'inherit' },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
  },
};

export function BarChart({
  data,
  height = 280,
  horizontal = false,
  onItemClick,
}: {
  data: { name: string; value: number }[];
  height?: number;
  horizontal?: boolean;
  /** Fired with the category name when the user clicks a bar. */
  onItemClick?: (name: string) => void;
}) {
  const opt = useMemo(() => {
    const cats = data.map((d) => d.name);
    const vals = data.map((d) => d.value);
    const cursor = onItemClick ? 'pointer' : 'default';
    if (horizontal) {
      return {
        ...BASE,
        grid: { ...BASE.grid, left: 120 },
        xAxis: { type: 'value', axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { lineStyle: { color: GRID_COLOR } } },
        yAxis: { type: 'category', data: cats, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisLabel: { color: AXIS_LABEL } },
        series: [{ type: 'bar', data: vals, itemStyle: { color: PALETTE[0], borderRadius: [0, 4, 4, 0] }, cursor, emphasis: { itemStyle: { color: '#2d46ad' } } }],
        tooltip: { ...BASE.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      };
    }
    return {
      ...BASE,
      xAxis: { type: 'category', data: cats, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisLabel: { color: '#8a93a3', interval: 0, rotate: cats.length > 6 ? 30 : 0 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { lineStyle: { color: GRID_COLOR } } },
      series: [{ type: 'bar', data: vals, itemStyle: { color: PALETTE[0], borderRadius: [4, 4, 0, 0] }, cursor, emphasis: { itemStyle: { color: '#2d46ad' } } }],
      tooltip: { ...BASE.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    };
  }, [data, horizontal, onItemClick]);
  const events = onItemClick
    ? {
        click: (p: any) => {
          const name = p?.name ?? p?.data?.name;
          if (typeof name === 'string') onItemClick(name);
        },
      }
    : undefined;
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={events} />;
}

export function StackedBarChart({
  categories,
  series,
  height = 320,
}: {
  categories: string[];
  series: { name: string; data: number[] }[];
  height?: number;
}) {
  const opt = useMemo(() => ({
    ...BASE,
    legend: { textStyle: { color: AXIS_LABEL }, top: 0 },
    grid: { ...BASE.grid, top: 36 },
    xAxis: { type: 'category', data: categories, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisLabel: { color: AXIS_LABEL } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { lineStyle: { color: GRID_COLOR } } },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'all',
      data: s.data,
      itemStyle: { color: PALETTE[i % PALETTE.length] },
    })),
    tooltip: { ...BASE.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    color: PALETTE,
  }), [categories, series]);
  return <ReactECharts option={opt} style={{ height }} notMerge />;
}

export function DonutChart({
  data,
  height = 280,
  onItemClick,
}: {
  data: { name: string; value: number }[];
  height?: number;
  /** Fired with the slice name when the user clicks a wedge. */
  onItemClick?: (name: string) => void;
}) {
  const opt = useMemo(() => ({
    ...BASE,
    legend: { textStyle: { color: '#8a93a3' }, orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        cursor: onItemClick ? 'pointer' : 'default',
        label: { show: false },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        data,
      },
    ],
    color: PALETTE,
    tooltip: { ...BASE.tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  }), [data, onItemClick]);
  const events = onItemClick
    ? {
        click: (p: any) => {
          const name = p?.name ?? p?.data?.name;
          if (typeof name === 'string') onItemClick(name);
        },
      }
    : undefined;
  return <ReactECharts option={opt} style={{ height }} notMerge onEvents={events} />;
}

export function FunnelChart({ data, height = 360 }: { data: { name: string; value: number }[]; height?: number }) {
  const opt = useMemo(() => ({
    ...BASE,
    tooltip: { ...BASE.tooltip, trigger: 'item', formatter: '{b}: {c}' },
    legend: { show: false },
    series: [
      {
        type: 'funnel',
        left: '10%',
        top: 10,
        bottom: 10,
        width: '80%',
        sort: 'none',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontWeight: 600,
          formatter: (p: any) => `${p.name}\n${Number(p.value).toLocaleString()}`,
        },
        labelLine: { show: false },
        itemStyle: { borderWidth: 0 },
        data,
      },
    ],
    color: PALETTE,
  }), [data]);
  return <ReactECharts option={opt} style={{ height }} notMerge />;
}

export function LineChart({
  categories,
  series,
  height = 280,
}: {
  categories: string[];
  /** Each series can opt into the secondary Y-axis via `yAxisIndex: 1`
   *  and supply an optional value formatter (e.g. percentage). */
  series: Array<{ name: string; data: number[]; yAxisIndex?: 0 | 1; formatter?: string }>;
  height?: number;
}) {
  const hasSecondary = series.some((s) => s.yAxisIndex === 1);
  const opt = useMemo(() => ({
    ...BASE,
    legend: { textStyle: { color: AXIS_LABEL }, top: 0 },
    grid: { ...BASE.grid, top: 36, right: hasSecondary ? 56 : 16 },
    xAxis: { type: 'category', boundaryGap: false, data: categories, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisLabel: { color: AXIS_LABEL } },
    yAxis: [
      { type: 'value', axisLine: { lineStyle: { color: AXIS_COLOR } }, splitLine: { lineStyle: { color: GRID_COLOR } } },
      ...(hasSecondary
        ? [{
            type: 'value',
            position: 'right',
            axisLine: { lineStyle: { color: AXIS_COLOR } },
            splitLine: { show: false },
            axisLabel: { color: AXIS_LABEL, formatter: '{value}%' },
          }]
        : []),
    ],
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      yAxisIndex: s.yAxisIndex ?? 0,
      data: s.data,
      lineStyle: { width: 2, color: PALETTE[i % PALETTE.length], type: s.yAxisIndex === 1 ? 'dashed' : 'solid' },
      itemStyle: { color: PALETTE[i % PALETTE.length] },
      tooltip: s.formatter ? { valueFormatter: (v: number) => s.formatter!.replace('{value}', v.toFixed(2)) } : undefined,
    })),
    color: PALETTE,
    tooltip: { ...BASE.tooltip, trigger: 'axis' },
  }), [categories, series, hasSecondary]);
  return <ReactECharts option={opt} style={{ height }} notMerge />;
}
