# Breakeven Report PDF Export Feature

## Overview
Added PDF export functionality to the breakeven screen, allowing drivers to export their breakeven reports as HTML files that can be shared via email, messaging, or other apps.

## Changes Made

### 1. **pdfExportService.js** (Enhanced)
- Added `expo-file-system` import for file handling
- Created `generatePDFContent()` function that generates professional HTML-formatted reports
- Enhanced `exportBreakevenReport()` to:
  - Generate HTML content with styled tables and summaries
  - Save HTML file to device document directory
  - Share file via native Share dialog
  - Support Daily, Weekly, and Monthly reports

**Features:**
- Professional HTML styling with color-coded status indicators
- Detailed breakdown table showing:
  - Period dates
  - Status (Breakeven + Profit, Breakeven, Below Breakeven)
  - Earnings and Expenses
  - Profit/Loss
  - Number of rides
- Overall summary statistics:
  - Total periods analyzed
  - Breakeven periods count
  - Success rate percentage
  - Total earnings, expenses, and net profit

### 2. **BreakevenChart.js** (Updated)
- Added `useState` hook for export loading state
- Added `ActivityIndicator` import for loading feedback
- Created `handleExport()` function with loading state management
- Updated PDF button to:
  - Show loading spinner during export
  - Disable button while exporting
  - Provide visual feedback to user

**UI Improvements:**
- Export button shows loading state with spinner
- Button is disabled during export to prevent multiple clicks
- Smooth user experience with proper state management

### 3. **DriverBreakevenScreen.js** (Updated)
- Updated import to use `exportBreakevenReport` instead of `exportBreakevenImage`
- Existing export handlers (`handleChartExportPDF`, `handleExportPDF`) now use the enhanced function
- Proper error handling with user feedback via error banner

## How It Works

1. **User clicks export button** on the breakeven chart
2. **Loading state activates** - button shows spinner
3. **HTML report is generated** with:
   - Header with report title and generation date
   - Detailed breakdown table of all periods
   - Overall summary statistics
   - Professional styling and color coding
4. **File is saved** to device document directory
5. **Native Share dialog opens** allowing user to:
   - Email the report
   - Send via messaging apps
   - Save to cloud storage
   - Print the file

## File Format
- **Format:** HTML (`.html`)
- **Filename:** `breakeven-report-{frequency}-{timestamp}.html`
- **Example:** `breakeven-report-daily-2024-01-15T10-30-45.html`

## Supported Frequencies
- Daily
- Weekly
- Monthly

## Error Handling
- Errors are caught and displayed in error banner
- User receives clear feedback if export fails
- Loading state is properly reset on error

## Dependencies
- `expo-file-system` - Already in package.json
- `react-native` Share API - Native functionality

## Testing
To test the feature:
1. Navigate to the Breakeven screen
2. Select a frequency (Daily/Weekly/Monthly)
3. Add some expenses
4. Scroll to the chart section
5. Click the PDF export button (document icon)
6. Select where to share/save the report
7. Verify the HTML file contains correct data

## Future Enhancements
- Add PDF generation (currently HTML, can be converted to PDF via browser)
- Add chart visualization to exported report
- Add driver information to report header
- Add custom date range selection for reports
- Add email integration for automatic report sending
