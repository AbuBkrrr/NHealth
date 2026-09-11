/**
 * CSV Export Utility for Admin Web
 * Allows admins to export user data, audit logs, and other records
 */

export interface CSVExportOptions {
  filename: string;
  headers: string[];
  data: any[];
  dateFormat?: 'ISO' | 'US' | 'EU';
}

export class CSVExportService {
  /**
   * Convert array of objects to CSV format
   */
  static objectsToCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) return '';

    // Auto-detect headers if not provided
    const keys = headers || Object.keys(data[0]);

    // Header row
    const headerRow = keys.map(key => this.escapeCSVField(key)).join(',');

    // Data rows
    const dataRows = data
      .map(row =>
        keys
          .map(key => {
            const value = row[key];
            return this.escapeCSVField(this.formatValue(value));
          })
          .join(',')
      )
      .join('\n');

    return `${headerRow}\n${dataRows}`;
  }

  /**
   * Export users to CSV
   */
  static exportUsers(
    users: any[],
    options: Partial<CSVExportOptions> = {}
  ): Blob {
    const headers = [
      'ID',
      'Name',
      'Email',
      'Phone',
      'Role',
      'Status',
      'Created At',
      'Last Login'
    ];

    const data = users.map(user => ({
      ID: user.id,
      Name: user.name,
      Email: user.email,
      Phone: user.phone || 'N/A',
      Role: user.role,
      Status: user.status || 'active',
      'Created At': new Date(user.createdAt).toISOString(),
      'Last Login': user.lastLogin ? new Date(user.lastLogin).toISOString() : 'N/A'
    }));

    const csv = this.objectsToCSV(data, headers);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export audit log to CSV
   */
  static exportAuditLog(
    logs: any[],
    options: Partial<CSVExportOptions> = {}
  ): Blob {
    const headers = [
      'Timestamp',
      'Admin',
      'Action',
      'Target User',
      'Target ID',
      'Changes',
      'IP Address'
    ];

    const data = logs.map(log => ({
      Timestamp: new Date(log.timestamp).toISOString(),
      Admin: log.adminName,
      Action: log.action,
      'Target User': log.targetUserName || 'N/A',
      'Target ID': log.targetUserId || 'N/A',
      Changes: JSON.stringify(log.changes || {}),
      'IP Address': log.ipAddress || 'N/A'
    }));

    const csv = this.objectsToCSV(data, headers);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export appointments to CSV
   */
  static exportAppointments(appointments: any[]): Blob {
    const headers = [
      'ID',
      'Patient',
      'Doctor',
      'Date',
      'Time',
      'Status',
      'Notes'
    ];

    const data = appointments.map(appt => ({
      ID: appt.id,
      Patient: appt.patientName,
      Doctor: appt.doctorName,
      Date: new Date(appt.scheduledFor).toLocaleDateString(),
      Time: new Date(appt.scheduledFor).toLocaleTimeString(),
      Status: appt.status,
      Notes: appt.notes || 'N/A'
    }));

    const csv = this.objectsToCSV(data, headers);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export payments/transactions to CSV
   */
  static exportPayments(payments: any[]): Blob {
    const headers = [
      'ID',
      'Date',
      'Payer',
      'Amount',
      'Method',
      'Status',
      'Reference'
    ];

    const data = payments.map(payment => ({
      ID: payment.id,
      Date: new Date(payment.createdAt).toLocaleDateString(),
      Payer: payment.payerName,
      Amount: `₦${Number(payment.amount).toLocaleString()}`,
      Method: payment.method,
      Status: payment.status,
      Reference: payment.reference || 'N/A'
    }));

    const csv = this.objectsToCSV(data, headers);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export orders to CSV
   */
  static exportOrders(orders: any[]): Blob {
    const headers = [
      'ID',
      'Pharmacy',
      'Patient',
      'Items',
      'Total',
      'Status',
      'Date'
    ];

    const data = orders.map(order => ({
      ID: order.id,
      Pharmacy: order.pharmacyName,
      Patient: order.patientName,
      Items: order.itemCount,
      Total: `₦${Number(order.total).toLocaleString()}`,
      Status: order.status,
      Date: new Date(order.createdAt).toLocaleDateString()
    }));

    const csv = this.objectsToCSV(data, headers);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Trigger browser download of CSV file
   */
  static downloadCSV(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Escape special characters in CSV field
   */
  private static escapeCSVField(field: string): string {
    if (field === null || field === undefined) return '';

    field = String(field);

    // Escape quotes and wrap in quotes if contains comma, newline, or quote
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }

    return field;
  }

  /**
   * Format value for CSV output
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) return '';

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Parse CSV to array of objects
   */
  static parseCSV(csv: string): any[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const obj: any = {};
      const currentLine = lines[i].split(',');

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = (currentLine[j] || '').trim();
      }

      data.push(obj);
    }

    return data;
  }
}

export default CSVExportService;
