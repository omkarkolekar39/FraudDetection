// Utility to export dashboard and customer 360 reports as PDF
// Uses jsPDF and html2canvas
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportDashboardReport({
  dashboardRef,
  stats,
  chartsSelectors = []
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 10;

  // Title
  doc.setFontSize(18);
  doc.text('Fraud Detection Dashboard Report', 10, y);
  y += 10;

  // Stats
  doc.setFontSize(12);
  doc.text(`Total Records: ${stats.totalRecords}`, 10, y);
  y += 7;
  doc.text(`High Risk Users: ${stats.highRisk}`, 10, y);
  y += 7;
  doc.text(`Medium Risk Users: ${stats.mediumRisk}`, 10, y);
  y += 7;
  doc.text(`Low Risk Users: ${stats.lowRisk}`, 10, y);
  y += 7;
  doc.text(`Risk Exposure Score: ${stats.riskExposure}%`, 10, y);
  y += 10;

  // Add charts as images
  for (const selector of chartsSelectors) {
    const chartElem = document.querySelector(selector);
    if (chartElem) {
      const canvas = await html2canvas(chartElem);
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 10, y, 180, 60);
      y += 65;
    }
  }

  doc.save('dashboard_report.pdf');
}

export async function exportCustomer360Report({
  customerRef,
  customerData
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 10;
  doc.setFontSize(18);
  doc.text('Customer 360 Report', 10, y);
  y += 10;

  // Customer details
  doc.setFontSize(12);
  Object.entries(customerData).forEach(([key, value]) => {
    doc.text(`${key}: ${value}`, 10, y);
    y += 7;
    if (y > 270) {
      doc.addPage();
      y = 10;
    }
  });

  // Optionally add charts or visualizations from customerRef
  if (customerRef) {
    const canvas = await html2canvas(customerRef);
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 10, y, 180, 60);
  }

  doc.save(`customer360_report_${customerData.Account_ID || 'customer'}.pdf`);
}
