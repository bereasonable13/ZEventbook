/**
 * Create mock sponsor analytics dashboard
 * Run this once to set up demo data
 */
function createMockSponsorDashboard() {
  // Create new spreadsheet
  const ss = SpreadsheetApp.create('NextUp - Sponsor ROI Dashboard (DEMO)');
  const sheet = ss.getActiveSheet();
  sheet.setName('Event Analytics');
  
  // Headers with styling
  const headers = [
    'Event Name', 'Entity', 'Date', 
    'Poster Scans', 'Display Impressions', 'Web Views',
    'Total Touchpoints', 'Registrations', 'Conversion %',
    'Sponsor Cost', 'Cost Per Touch', 'ROI Status'
  ];
  
  sheet.getRange(1, 1, 1, 12).setValues([headers]);
  sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  sheet.getRange(1, 1, 1, 12).setBackground('#c8102e');
  sheet.getRange(1, 1, 1, 12).setFontColor('#ffffff');
  
  // Mock data for 10 events
  const mockData = [
    ['ABC Open 2024', 'ABC-Tournaments', '2024-12-14', 347, 2450, 892, 3689, 234, '26.2%', '$5,000', '$1.35', 'Excellent'],
    ['Summer League Night', 'ABC-Leagues', '2024-07-15', 156, 1230, 445, 1831, 112, '25.2%', '$2,000', '$1.09', 'Excellent'],
    ['CBC Fall Social', 'ABC-ChicagoBocceClub', '2024-09-20', 289, 1890, 672, 2851, 178, '26.5%', '$3,500', '$1.23', 'Excellent'],
    ['CBL Championship', 'ABC-ChicagoBocceLeague', '2024-10-05', 412, 3120, 1045, 4577, 298, '28.5%', '$7,500', '$1.64', 'Good'],
    ['Spring Tournament', 'ABC-Tournaments', '2024-04-12', 234, 1670, 523, 2427, 156, '29.8%', '$3,000', '$1.24', 'Excellent'],
    ['Monday Night League', 'ABC-Leagues', '2024-06-03', 89, 890, 267, 1246, 67, '25.1%', '$1,500', '$1.20', 'Excellent'],
    ['CBC Beer Garden Event', 'ABC-ChicagoBocceClub', '2024-08-15', 456, 2340, 892, 3688, 245, '27.5%', '$4,000', '$1.08', 'Excellent'],
    ['CBL Playoff Series', 'ABC-ChicagoBocceLeague', '2024-11-02', 378, 2890, 723, 3991, 267, '26.9%', '$6,000', '$1.50', 'Good'],
    ['Winter League Kickoff', 'ABC-Leagues', '2024-01-08', 198, 1450, 534, 2182, 145, '27.2%', '$2,500', '$1.15', 'Excellent'],
    ['ABC Regional Finals', 'ABC-Tournaments', '2024-11-20', 523, 3560, 1234, 5317, 389, '29.6%', '$8,000', '$1.50', 'Excellent']
  ];
  
  sheet.getRange(2, 1, 10, 12).setValues(mockData);
  
  // Format numbers
  sheet.getRange(2, 4, 10, 3).setNumberFormat('#,##0');
  sheet.getRange(2, 7, 10, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 8, 10, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 10, 10, 1).setNumberFormat('$#,##0');
  sheet.getRange(2, 11, 10, 1).setNumberFormat('$0.00');
  
  // Add summary row
  sheet.getRange(12, 1).setValue('TOTAL/AVERAGE:');
  sheet.getRange(12, 1).setFontWeight('bold');
  sheet.getRange(12, 4).setFormula('=SUM(D2:D11)');
  sheet.getRange(12, 5).setFormula('=SUM(E2:E11)');
  sheet.getRange(12, 6).setFormula('=SUM(F2:F11)');
  sheet.getRange(12, 7).setFormula('=SUM(G2:G11)');
  sheet.getRange(12, 8).setFormula('=SUM(H2:H11)');
  sheet.getRange(12, 10).setFormula('=SUM(J2:J11)');
  sheet.getRange(12, 11).setFormula('=AVERAGE(K2:K11)');
  
  // Auto-resize
  sheet.autoResizeColumns(1, 12);
  
  // Create Summary Dashboard sheet
  const dashboardSheet = ss.insertSheet('Sponsor Dashboard');
  
  // Dashboard header
  dashboardSheet.getRange('A1:F1').merge();
  dashboardSheet.getRange('A1').setValue('NextUp Sponsor ROI Dashboard');
  dashboardSheet.getRange('A1').setFontSize(18);
  dashboardSheet.getRange('A1').setFontWeight('bold');
  dashboardSheet.getRange('A1').setBackground('#c8102e');
  dashboardSheet.getRange('A1').setFontColor('#ffffff');
  dashboardSheet.getRange('A1').setHorizontalAlignment('center');
  
  // Key metrics
  dashboardSheet.getRange('A3').setValue('TOTAL CAMPAIGN REACH');
  dashboardSheet.getRange('B3').setFormula('=\'Event Analytics\'!G12');
  dashboardSheet.getRange('B3').setNumberFormat('#,##0');
  dashboardSheet.getRange('B3').setFontSize(24);
  dashboardSheet.getRange('B3').setFontWeight('bold');
  
  dashboardSheet.getRange('A5').setValue('Total Investment:');
  dashboardSheet.getRange('B5').setFormula('=\'Event Analytics\'!J12');
  dashboardSheet.getRange('B5').setNumberFormat('$#,##0');
  
  dashboardSheet.getRange('A6').setValue('Average Cost Per Touch:');
  dashboardSheet.getRange('B6').setFormula('=\'Event Analytics\'!K12');
  dashboardSheet.getRange('B6').setNumberFormat('$0.00');
  
  dashboardSheet.getRange('A7').setValue('Total Registrations:');
  dashboardSheet.getRange('B7').setFormula('=\'Event Analytics\'!H12');
  dashboardSheet.getRange('B7').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A8').setValue('Average Conversion:');
  dashboardSheet.getRange('B8').setValue('27.2%');
  
  dashboardSheet.getRange('A10').setValue('BREAKDOWN BY CHANNEL:');
  dashboardSheet.getRange('A10').setFontWeight('bold');
  
  dashboardSheet.getRange('A11').setValue('Poster QR Scans:');
  dashboardSheet.getRange('B11').setFormula('=\'Event Analytics\'!D12');
  dashboardSheet.getRange('B11').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A12').setValue('Display Impressions:');
  dashboardSheet.getRange('B12').setFormula('=\'Event Analytics\'!E12');
  dashboardSheet.getRange('B12').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A13').setValue('Web Page Views:');
  dashboardSheet.getRange('B13').setFormula('=\'Event Analytics\'!F12');
  dashboardSheet.getRange('B13').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A15').setValue('ROI ASSESSMENT:');
  dashboardSheet.getRange('A15').setFontWeight('bold');
  dashboardSheet.getRange('A16').setValue('✓ Cost per touchpoint under $1.50 target');
  dashboardSheet.getRange('A17').setValue('✓ Conversion rate above 25% benchmark');
  dashboardSheet.getRange('A18').setValue('✓ All events showing positive ROI');
  dashboardSheet.getRange('A19').setValue('✓ Multi-channel reach verified');
  
  // Auto-resize dashboard
  dashboardSheet.autoResizeColumns(1, 6);
  
  Logger.log('Mock Sponsor Dashboard created!');
  Logger.log('URL: ' + ss.getUrl());
  
  return ss.getUrl();
}
