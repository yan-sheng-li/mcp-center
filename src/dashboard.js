export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Center - Statistics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1923; color: #e0e6ed; min-height: 100vh; }

    .dashboard { max-width: 1600px; margin: 0 auto; padding: 24px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .header h1 { font-size: 24px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 10px; }
    .header h1 .icon { font-size: 28px; }
    .header-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .header-controls a { color: #4fc3f7; text-decoration: none; font-size: 13px; padding: 6px 14px; border: 1px solid #2a3a4a; border-radius: 4px; transition: all 0.2s; }
    .header-controls a:hover { background: #1a2a3a; border-color: #4fc3f7; }

    select, .btn { padding: 7px 14px; border-radius: 4px; font-size: 13px; border: 1px solid #2a3a4a; background: #1a2a3a; color: #e0e6ed; cursor: pointer; transition: all 0.2s; }
    select:hover { border-color: #4fc3f7; }
    select:focus { outline: none; border-color: #4fc3f7; }

    .auto-refresh { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #8a9bb5; }
    .auto-refresh label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #2a3a4a; border-radius: 20px; transition: 0.2s; }
    .toggle-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: #8a9bb5; border-radius: 50%; transition: 0.2s; }
    .toggle input:checked + .toggle-slider { background: #0288d1; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(16px); background: #fff; }

    .last-updated { font-size: 12px; color: #5a6b7d; }

    /* KPI Cards */
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: linear-gradient(135deg, #1a2a3a 0%, #1e3345 100%); border: 1px solid #2a3a4a; border-radius: 8px; padding: 20px; position: relative; overflow: hidden; }
    .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
    .kpi-card.calls::before { background: linear-gradient(90deg, #4fc3f7, #0288d1); }
    .kpi-card.success::before { background: linear-gradient(90deg, #66bb6a, #2e7d32); }
    .kpi-card.duration::before { background: linear-gradient(90deg, #ffa726, #ef6c00); }
    .kpi-card.tools::before { background: linear-gradient(90deg, #ab47bc, #7b1fa2); }
    .kpi-label { font-size: 12px; color: #8a9bb5; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .kpi-value { font-size: 32px; font-weight: 700; line-height: 1.1; }
    .kpi-card.calls .kpi-value { color: #4fc3f7; }
    .kpi-card.success .kpi-value { color: #66bb6a; }
    .kpi-card.duration .kpi-value { color: #ffa726; }
    .kpi-card.tools .kpi-value { color: #ab47bc; }
    .kpi-sub { font-size: 12px; color: #5a6b7d; margin-top: 6px; }

    /* Chart Grid */
    .chart-row { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; margin-bottom: 24px; }
    .chart-card { background: linear-gradient(135deg, #1a2a3a 0%, #1e3345 100%); border: 1px solid #2a3a4a; border-radius: 8px; padding: 20px; }
    .chart-card h3 { font-size: 14px; color: #8a9bb5; margin-bottom: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .chart-container { width: 100%; height: 320px; }

    /* Type Distribution Row */
    .chart-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }

    /* Table */
    .table-card { background: linear-gradient(135deg, #1a2a3a 0%, #1e3345 100%); border: 1px solid #2a3a4a; border-radius: 8px; padding: 20px; }
    .table-card h3 { font-size: 14px; color: #8a9bb5; margin-bottom: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
    .table-wrap { overflow-x: auto; max-height: 420px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { position: sticky; top: 0; z-index: 1; }
    th { background: #0f1923; color: #8a9bb5; text-align: left; padding: 10px 12px; font-weight: 500; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #2a3a4a; }
    td { padding: 10px 12px; border-bottom: 1px solid #1a2a3a; color: #c0cdd9; }
    tr:hover td { background: rgba(79, 195, 247, 0.04); }
    .status-success { color: #66bb6a; font-weight: 600; }
    .status-error { color: #ef5350; font-weight: 600; }
    .type-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; }
    .type-tool { background: rgba(79, 195, 247, 0.15); color: #4fc3f7; }
    .type-resource { background: rgba(255, 167, 38, 0.15); color: #ffa726; }
    .type-prompt { background: rgba(171, 71, 188, 0.15); color: #ab47bc; }
    .mono { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; }
    .empty-msg { text-align: center; color: #5a6b7d; padding: 40px; font-size: 14px; }

    /* Loading */
    .loading { display: flex; align-items: center; justify-content: center; padding: 60px; color: #5a6b7d; }
    .spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #2a3a4a; border-top-color: #4fc3f7; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 10px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Responsive */
    @media (max-width: 1200px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .chart-row, .chart-row-2 { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .kpi-row { grid-template-columns: 1fr; }
      .dashboard { padding: 12px; }
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0f1923; }
    ::-webkit-scrollbar-thumb { background: #2a3a4a; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #3a4a5a; }
  </style>
</head>
<body>
  <div class="dashboard">
    <!-- Header -->
    <div class="header">
      <h1><span class="icon">&#128202;</span> MCP Center Statistics</h1>
      <div class="header-controls">
        <select id="periodSelect" onchange="refreshAll()">
          <option value="1h">Last 1 Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h" selected>Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        <div class="auto-refresh">
          <label>
            <div class="toggle">
              <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh()">
              <span class="toggle-slider"></span>
            </div>
            Auto-refresh
          </label>
        </div>
        <span class="last-updated" id="lastUpdated"></span>
        <a href="/ui">&larr; Server Management</a>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-row">
      <div class="kpi-card calls">
        <div class="kpi-label">Total Calls</div>
        <div class="kpi-value" id="kpiTotalCalls">-</div>
        <div class="kpi-sub" id="kpiCallsSub"></div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">Success Rate</div>
        <div class="kpi-value" id="kpiSuccessRate">-</div>
        <div class="kpi-sub" id="kpiSuccessSub"></div>
      </div>
      <div class="kpi-card duration">
        <div class="kpi-label">Avg Duration</div>
        <div class="kpi-value" id="kpiAvgDuration">-</div>
        <div class="kpi-sub" id="kpiDurationSub"></div>
      </div>
      <div class="kpi-card tools">
        <div class="kpi-label">Active Tools / Servers</div>
        <div class="kpi-value" id="kpiActiveTools">-</div>
        <div class="kpi-sub" id="kpiToolsSub"></div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="chart-row">
      <div class="chart-card">
        <h3>Call Timeline</h3>
        <div class="chart-container" id="timelineChart"></div>
      </div>
      <div class="chart-card">
        <h3>Tool Usage Ranking</h3>
        <div class="chart-container" id="toolsChart"></div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="chart-row-2">
      <div class="chart-card">
        <h3>Call Type Distribution</h3>
        <div class="chart-container" id="typePieChart"></div>
      </div>
      <div class="chart-card">
        <h3>Server Load</h3>
        <div class="chart-container" id="serverChart"></div>
      </div>
    </div>

    <!-- Recent Logs Table -->
    <div class="table-card">
      <h3>Recent Calls <span id="logCount" style="font-size:12px;color:#5a6b7d;font-weight:400;text-transform:none;letter-spacing:0"></span></h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Name</th>
              <th>Server</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Client IP</th>
            </tr>
          </thead>
          <tbody id="logTableBody">
            <tr><td colspan="7" class="empty-msg">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    // ===== Chart instances =====
    let timelineChart, toolsChart, typePieChart, serverChart;
    let refreshTimer = null;
    const REFRESH_INTERVAL = 10000; // 10s

    // ===== ECharts theme colors =====
    const COLORS = ['#4fc3f7', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc', '#26c6da', '#ffee58', '#8d6e63'];

    function initCharts() {
      const darkTheme = {
        backgroundColor: 'transparent',
        textStyle: { color: '#8a9bb5', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
        legend: { textStyle: { color: '#8a9bb5' } },
        tooltip: { backgroundColor: 'rgba(15,25,35,0.95)', borderColor: '#2a3a4a', textStyle: { color: '#e0e6ed', fontSize: 12 } },
      };

      timelineChart = echarts.init(document.getElementById('timelineChart'));
      toolsChart = echarts.init(document.getElementById('toolsChart'));
      typePieChart = echarts.init(document.getElementById('typePieChart'));
      serverChart = echarts.init(document.getElementById('serverChart'));

      // Apply base dark theme
      [timelineChart, toolsChart, typePieChart, serverChart].forEach(c => {
        c.setOption(darkTheme, true);
      });
    }

    function resizeCharts() {
      [timelineChart, toolsChart, typePieChart, serverChart].forEach(c => c && c.resize());
    }
    window.addEventListener('resize', resizeCharts);

    // ===== Data fetching =====
    function getPeriod() {
      return document.getElementById('periodSelect').value;
    }

    async function fetchJSON(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }

    // ===== Render functions =====

    function renderKPI(data) {
      document.getElementById('kpiTotalCalls').textContent = data.totalCalls.toLocaleString();
      document.getElementById('kpiSuccessRate').textContent = data.successRate + '%';
      document.getElementById('kpiAvgDuration').textContent = data.avgDuration.toLocaleString() + 'ms';
      document.getElementById('kpiActiveTools').textContent = data.activeTools + ' / ' + data.activeServers;

      document.getElementById('kpiCallsSub').textContent = 'API calls in selected period';
      const successCalls = Math.round(data.totalCalls * data.successRate / 100);
      const errorCalls = data.totalCalls - successCalls;
      document.getElementById('kpiSuccessSub').textContent = successCalls + ' success, ' + errorCalls + ' error';
      document.getElementById('kpiDurationSub').textContent = 'Average response time';
      document.getElementById('kpiToolsSub').textContent = 'Distinct tools / servers';
    }

    function renderTimeline(data) {
      if (!data || data.length === 0) {
        timelineChart.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#5a6b7d', fontSize: 14 } } });
        return;
      }

      const xData = data.map(d => {
        const dt = new Date(d.timestamp);
        return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });
      // Deduplicate x labels if many
      const xUnique = [];
      const seen = new Set();
      xData.forEach((v, i) => {
        if (!seen.has(v) || i === xData.length - 1) { xUnique.push(v); }
        else { xUnique.push(''); }
        seen.add(v);
      });

      timelineChart.setOption({
        title: undefined,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15,25,35,0.95)',
          borderColor: '#2a3a4a',
          textStyle: { color: '#e0e6ed', fontSize: 12 },
          formatter: function(params) {
            if (!params || !params.length) return '';
            let html = '<div style="font-weight:600;margin-bottom:4px">' + params[0].axisValue + '</div>';
            params.forEach(p => {
              html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0">'
                + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + p.color + '"></span>'
                + p.seriesName + ': <b>' + p.value + '</b></div>';
            });
            return html;
          }
        },
        legend: { data: ['Success', 'Error'], top: 0, right: 0, textStyle: { color: '#8a9bb5', fontSize: 12 } },
        grid: { left: 50, right: 20, top: 36, bottom: 30 },
        xAxis: { type: 'category', data: xData, axisLine: { lineStyle: { color: '#2a3a4a' } }, axisLabel: { color: '#5a6b7d', fontSize: 11 }, axisTick: { show: false } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2a3a' } }, axisLabel: { color: '#5a6b7d', fontSize: 11 }, axisLine: { show: false } },
        series: [
          {
            name: 'Success',
            type: 'line',
            data: data.map(d => d.success),
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: '#66bb6a' },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(102,187,106,0.3)' }, { offset: 1, color: 'rgba(102,187,106,0.02)' }] } },
            itemStyle: { color: '#66bb6a' },
          },
          {
            name: 'Error',
            type: 'line',
            data: data.map(d => d.error),
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: '#ef5350' },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,83,80,0.3)' }, { offset: 1, color: 'rgba(239,83,80,0.02)' }] } },
            itemStyle: { color: '#ef5350' },
          }
        ]
      }, true);
    }

    function renderToolRanking(data) {
      const top10 = data.slice(0, 10);
      if (top10.length === 0) {
        toolsChart.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#5a6b7d', fontSize: 14 } } });
        return;
      }

      const names = top10.map(d => {
        const n = d.name;
        return n.length > 28 ? n.substring(0, 26) + '...' : n;
      }).reverse();
      const values = top10.map(d => d.totalCalls).reverse();
      const successRates = top10.map(d => d.successRate).reverse();

      toolsChart.setOption({
        title: undefined,
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(15,25,35,0.95)',
          borderColor: '#2a3a4a',
          textStyle: { color: '#e0e6ed', fontSize: 12 },
          formatter: function(params) {
            const p = params[0];
            const item = top10[top10.length - 1 - p.dataIndex];
            return '<b>' + item.name + '</b><br/>'
              + 'Calls: ' + item.totalCalls + '<br/>'
              + 'Success: ' + item.successRate + '%<br/>'
              + 'Avg: ' + item.avgDuration + 'ms';
          }
        },
        grid: { left: 200, right: 60, top: 10, bottom: 20 },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2a3a' } }, axisLabel: { color: '#5a6b7d', fontSize: 11 }, axisLine: { show: false } },
        yAxis: { type: 'category', data: names, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#c0cdd9', fontSize: 11, width: 180, overflow: 'truncate' } },
        series: [{
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(79,195,247,0.3)' }, { offset: 1, color: '#4fc3f7' }] },
              borderRadius: [0, 3, 3, 0],
            }
          })),
          barMaxWidth: 20,
          label: { show: true, position: 'right', color: '#8a9bb5', fontSize: 11, formatter: function(p) { return p.value; } },
        }]
      }, true);
    }

    function renderTypePie(data) {
      // Aggregate by type from tool stats
      const typeMap = {};
      (data || []).forEach(d => {
        typeMap[d.type] = (typeMap[d.type] || 0) + d.totalCalls;
      });

      const pieData = Object.entries(typeMap).map(([type, value], i) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: value,
        itemStyle: { color: COLORS[i % COLORS.length] }
      }));

      if (pieData.length === 0) {
        typePieChart.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#5a6b7d', fontSize: 14 } } });
        return;
      }

      typePieChart.setOption({
        title: undefined,
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(15,25,35,0.95)',
          borderColor: '#2a3a4a',
          textStyle: { color: '#e0e6ed', fontSize: 12 },
          formatter: '{b}: {c} ({d}%)'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#1a2a3a', borderWidth: 2, borderRadius: 4 },
          label: { color: '#c0cdd9', fontSize: 12 },
          labelLine: { lineStyle: { color: '#2a3a4a' } },
          emphasis: {
            label: { fontSize: 14, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' }
          },
          data: pieData,
        }]
      }, true);
    }

    function renderServerLoad(data) {
      // Aggregate by server from tool stats
      const serverMap = {};
      (data || []).forEach(d => {
        const name = d.serverName || 'Unknown';
        if (!serverMap[name]) serverMap[name] = { calls: 0, success: 0 };
        serverMap[name].calls += d.totalCalls;
        serverMap[name].success += d.successCount;
      });

      const entries = Object.entries(serverMap).sort((a, b) => b[1].calls - a[1].calls).slice(0, 8);

      if (entries.length === 0) {
        serverChart.setOption({ title: { text: 'No data', left: 'center', top: 'center', textStyle: { color: '#5a6b7d', fontSize: 14 } } });
        return;
      }

      const names = entries.map(e => e[0]);
      const calls = entries.map(e => e[1].calls);
      const success = entries.map(e => e[1].success);
      const errors = entries.map(e => e[1].calls - e[1].success);

      serverChart.setOption({
        title: undefined,
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(15,25,35,0.95)',
          borderColor: '#2a3a4a',
          textStyle: { color: '#e0e6ed', fontSize: 12 },
        },
        legend: { data: ['Success', 'Error'], top: 0, right: 0, textStyle: { color: '#8a9bb5', fontSize: 12 } },
        grid: { left: 16, right: 16, top: 36, bottom: 16, containLabel: true },
        xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: '#2a3a4a' } }, axisLabel: { color: '#c0cdd9', fontSize: 11, rotate: names.some(n => n.length > 10) ? 20 : 0 }, axisTick: { show: false } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a2a3a' } }, axisLabel: { color: '#5a6b7d', fontSize: 11 }, axisLine: { show: false } },
        series: [
          {
            name: 'Success',
            type: 'bar',
            stack: 'total',
            data: success,
            itemStyle: { color: '#66bb6a', borderRadius: [0, 0, 0, 0] },
            barMaxWidth: 40,
          },
          {
            name: 'Error',
            type: 'bar',
            stack: 'total',
            data: errors,
            itemStyle: { color: '#ef5350', borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 40,
          }
        ]
      }, true);
    }

    function renderRecentLogs(data) {
      const tbody = document.getElementById('logTableBody');
      document.getElementById('logCount').textContent = data.length > 0 ? '(latest ' + data.length + ')' : '';

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No call records yet. Start using MCP tools to see activity here.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(row => {
        const time = new Date(row.timestamp).toLocaleString();
        const statusClass = row.status === 'success' ? 'status-success' : 'status-error';
        const typeClass = 'type-' + (row.type || 'tool');
        const duration = row.durationMs != null ? row.durationMs + 'ms' : '-';
        const errorInfo = row.errorMsg ? ' title="' + escAttr(row.errorMsg) + '"' : '';
        const name = row.name || '-';
        const server = row.serverName || '-';
        const ip = row.clientIp || '-';

        return '<tr' + errorInfo + '>'
          + '<td class="mono">' + escHtml(time) + '</td>'
          + '<td><span class="type-badge ' + typeClass + '">' + escHtml(row.type) + '</span></td>'
          + '<td class="mono" title="' + escAttr(name) + '">' + escHtml(truncate(name, 40)) + '</td>'
          + '<td>' + escHtml(server) + '</td>'
          + '<td class="' + statusClass + '">' + escHtml(row.status) + '</td>'
          + '<td class="mono">' + duration + '</td>'
          + '<td class="mono">' + escHtml(ip) + '</td>'
          + '</tr>';
      }).join('');
    }

    // ===== Helpers =====
    function escHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escAttr(str) {
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function truncate(str, len) {
      return str.length > len ? str.substring(0, len - 2) + '..' : str;
    }

    function getTimelineGranularity(period) {
      if (period === '1h') return '5m';
      if (period === '6h') return '15m';
      if (period === '24h') return '1h';
      if (period === '7d') return '6h';
      return '1d';
    }

    // ===== Refresh all =====
    async function refreshAll() {
      const period = getPeriod();
      const granularity = getTimelineGranularity(period);

      try {
        const [overview, tools, timeline, recent] = await Promise.all([
          fetchJSON('/api/stats/overview?period=' + period),
          fetchJSON('/api/stats/tools?period=' + period),
          fetchJSON('/api/stats/timeline?period=' + period + '&granularity=' + granularity),
          fetchJSON('/api/stats/recent?limit=50'),
        ]);

        renderKPI(overview);
        renderTimeline(timeline);
        renderToolRanking(tools);
        renderTypePie(tools);
        renderServerLoad(tools);
        renderRecentLogs(recent);

        document.getElementById('lastUpdated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
      } catch (err) {
        console.error('Failed to refresh dashboard:', err);
      }
    }

    // ===== Auto refresh =====
    function toggleAutoRefresh() {
      const checked = document.getElementById('autoRefresh').checked;
      if (checked) {
        refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL);
      } else {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      }
    }

    // ===== Init =====
    document.addEventListener('DOMContentLoaded', () => {
      initCharts();
      refreshAll();
      refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL);
    });
  </script>
</body>
</html>`;
