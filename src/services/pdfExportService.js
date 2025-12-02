import { Share, Alert } from 'react-native';

function formatPeso(n) {
  const num = Number(n || 0);
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPeriodLabel(item) {
  const start = new Date(item.period_start);
  const timeZone = 'Asia/Manila';

  if (item.period_type === 'daily') {
    return start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone });
  }
  if (item.period_type === 'weekly') {
    const monday = new Date(start);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + daysToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const s = monday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone });
    const e = sunday.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone });
    return `${s} - ${e}`;
  }
  if (item.period_type === 'monthly') {
    return start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone });
  }
  return 'Unknown';
}

function generatePDFContent(data = [], frequency = 'Daily') {
  const reportDate = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6d2932; padding-bottom: 15px; }
        .header h1 { margin: 0; color: #6d2932; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; font-size: 12px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 14px; font-weight: bold; color: #6d2932; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background-color: #f0e7e3; padding: 8px; text-align: left; font-weight: bold; font-size: 12px; border: 1px solid #ddd; }
        td { padding: 8px; font-size: 11px; border: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #fafafa; }
        .status-success { color: #1B5E20; font-weight: bold; }
        .status-warning { color: #8B6B1F; font-weight: bold; }
        .status-danger { color: #B3261E; font-weight: bold; }
        .summary-box { background-color: #f0e7e3; padding: 12px; border-radius: 4px; margin-bottom: 10px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
        .summary-label { font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TarTrack Breakeven Report</h1>
        <p>Period: ${frequency}</p>
        <p>Generated on ${reportDate}</p>
      </div>
  `;

  if (!data || data.length === 0) {
    html += `<div class="section"><p>No breakeven data available for the selected period.</p></div>`;
  } else {
    // Detailed breakdown
    html += `<div class="section"><div class="section-title">Breakeven Summary</div><table>`;
    html += `<tr><th>Period</th><th>Status</th><th>Earnings</th><th>Expenses</th><th>Profit/Loss</th><th>Rides</th></tr>`;
    
    data.forEach((item) => {
      const earnings = Number(item.revenue_driver) || 0;
      const expenses = Number(item.expenses) || 0;
      const profit = earnings - expenses;
      const breakevenHit = earnings >= expenses;
      const profitable = profit > 0;
      
      let status = 'Below Breakeven';
      let statusClass = 'status-danger';
      if (breakevenHit && profitable) {
        status = 'Breakeven + Profit';
        statusClass = 'status-success';
      } else if (breakevenHit && !profitable) {
        status = 'Breakeven';
        statusClass = 'status-warning';
      }
      
      html += `<tr>`;
      html += `<td>${formatPeriodLabel(item)}</td>`;
      html += `<td class="${statusClass}">${status}</td>`;
      html += `<td>${formatPeso(earnings)}</td>`;
      html += `<td>${formatPeso(expenses)}</td>`;
      html += `<td>${formatPeso(profit)}</td>`;
      html += `<td>${item.total_bookings || 0}</td>`;
      html += `</tr>`;
    });
    
    html += `</table></div>`;
    
    // Summary statistics
    const totalEarnings = data.reduce((sum, item) => sum + (Number(item.revenue_driver) || 0), 0);
    const totalExpenses = data.reduce((sum, item) => sum + (Number(item.expenses) || 0), 0);
    const totalProfit = totalEarnings - totalExpenses;
    const breakevenPeriods = data.filter(item => (Number(item.revenue_driver) || 0) >= (Number(item.expenses) || 0)).length;
    const successRate = data.length > 0 ? ((breakevenPeriods / data.length) * 100).toFixed(1) : 0;
    
    html += `<div class="section"><div class="section-title">Overall Summary</div>`;
    html += `<div class="summary-box">`;
    html += `<div class="summary-row"><span class="summary-label">Total Periods:</span><span>${data.length}</span></div>`;
    html += `<div class="summary-row"><span class="summary-label">Breakeven Periods:</span><span>${breakevenPeriods}</span></div>`;
    html += `<div class="summary-row"><span class="summary-label">Success Rate:</span><span>${successRate}%</span></div>`;
    html += `<div class="summary-row"><span class="summary-label">Total Earnings:</span><span>${formatPeso(totalEarnings)}</span></div>`;
    html += `<div class="summary-row"><span class="summary-label">Total Expenses:</span><span>${formatPeso(totalExpenses)}</span></div>`;
    html += `<div class="summary-row"><span class="summary-label">Net Profit/Loss:</span><span>${formatPeso(totalProfit)}</span></div>`;
    html += `</div></div>`;
  }

  html += `
      <div class="footer">
        <p>Generated by TarTrack App</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export const exportBreakevenReport = async (data = [], frequency = 'Daily') => {
  try {
    const htmlContent = generatePDFContent(data, frequency);
    const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
    const dataUrl = `data:text/html;base64,${base64}`;

    await Share.share({
      message: `TarTrack Breakeven Report (${frequency})`,
      url: dataUrl,
      title: `Breakeven Report - ${frequency}`,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const exportBreakevenImage = exportBreakevenReport;
