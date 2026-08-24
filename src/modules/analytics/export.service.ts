/**
 * src/modules/analytics/export.service.ts
 *
 * Professional Excel (.xlsx) report generation service using ExcelJS.
 */

import ExcelJS from 'exceljs';
import { dataStore } from '../../database/dataStore';

export class ExportService {
  /**
   * Generates formatted Excel workbook for Ticket Sales
   */
  async generateSalesReport(tenantId: string, eventId?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WhiteLabel Event Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Laporan Penjualan Tiket', {
      views: [{ showGridLines: true }],
    });

    // Title Banner
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REKAPITULASI PENJUALAN TIKET EVENT';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:L2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Dicetak pada: ${new Date().toLocaleString('id-ID')} | Platform: WhiteLabel Ticketing`;
    subtitleCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Blank row
    sheet.addRow([]);

    // Headers
    const headers = [
      'No',
      'Order ID',
      'Tanggal Transaksi',
      'Nama Pembeli',
      'Email Pembeli',
      'Nama Event',
      'Tier Tiket',
      'Jumlah',
      'Harga Satuan (Rp)',
      'Potongan Promo (Rp)',
      'Total Bayar (Rp)',
      'Status Order',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }, // Indigo 600
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
      };
    });

    // Populate data
    const orders = dataStore.orders.filter((o) => {
      if (o.tenant_id !== tenantId) return false;
      if (eventId && o.event_id !== eventId) return false;
      return true;
    });

    let rowIndex = 1;
    let grandTotalRevenue = 0;
    let grandTotalTickets = 0;

    orders.forEach((order) => {
      const user = dataStore.users.find((u) => u.id === order.user_id);
      const event = dataStore.events.find((e) => e.id === order.event_id);

      order.items.forEach((item) => {
        const row = sheet.addRow([
          rowIndex++,
          order.id,
          new Date(order.created_at).toLocaleString('id-ID'),
          user?.name || 'Customer',
          user?.email || '-',
          event?.name || order.event_id,
          item.tier_name,
          item.quantity,
          item.unit_price,
          order.discount_amount || 0,
          order.amount,
          order.status.toUpperCase(),
        ]);

        grandTotalRevenue += order.status === 'paid' ? order.amount : 0;
        grandTotalTickets += item.quantity;

        row.height = 20;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { vertical: 'middle' };

          // Number formatting for price columns
          if (colNumber === 9 || colNumber === 10 || colNumber === 11) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
          if (colNumber === 1 || colNumber === 8 || colNumber === 12) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });
    });

    // Summary Row
    sheet.addRow([]);
    const summaryRow = sheet.addRow([
      '',
      'TOTAL REKAPITULASI',
      '',
      '',
      '',
      '',
      '',
      grandTotalTickets,
      '',
      '',
      grandTotalRevenue,
      '',
    ]);
    summaryRow.height = 24;
    summaryRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
    });

    // Set Column Widths
    sheet.columns = [
      { width: 6 },  // No
      { width: 22 }, // Order ID
      { width: 20 }, // Tanggal
      { width: 22 }, // Nama Pembeli
      { width: 26 }, // Email
      { width: 28 }, // Event
      { width: 22 }, // Tier
      { width: 10 }, // Qty
      { width: 18 }, // Harga Satuan
      { width: 20 }, // Diskon Promo
      { width: 20 }, // Total Bayar
      { width: 14 }, // Status
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates formatted Excel workbook for Gate Scan Check-ins
   */
  async generateGateLogReport(tenantId: string, eventId?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Log Gate Scan Masuk');

    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'LOG CHECK-IN GATE SCANNER EVENT';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    const headers = [
      'No',
      'Scan ID',
      'Waktu Scan',
      'Ticket ID',
      'Tier Tiket',
      'Nama Pemegang',
      'Gate Device ID',
      'Hasil Validasi',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald 600
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const logs = dataStore.gateScanLogs;
    logs.forEach((log, index) => {
      const ticket = dataStore.tickets.find((t) => t.id === log.ticket_id);
      const user = ticket ? dataStore.users.find((u) => u.id === ticket.user_id) : null;

      const row = sheet.addRow([
        index + 1,
        log.id,
        new Date(log.scanned_at).toLocaleString('id-ID'),
        log.ticket_id,
        ticket?.tier_name || '-',
        user?.name || '-',
        log.gate_device_id,
        log.result.toUpperCase(),
      ]);

      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle' };
        if (colNumber === 1 || colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    sheet.columns = [
      { width: 6 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
      { width: 24 },
      { width: 18 },
      { width: 16 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates formatted Excel workbook for Cashless Booth Transactions
   */
  async generateBoothTransactionReport(tenantId: string, eventId?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transaksi Booth Cashless');

    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REKAPITULASI TRANSAKSI CASHLESS VENDOR & BOOTH';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    const headers = [
      'No',
      'Tx ID',
      'Waktu Transaksi',
      'Wallet ID',
      'Jenis Transaksi',
      'Nominal (Rp)',
      'Keterangan Transaksi',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber 600
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    dataStore.walletTxs.forEach((tx, index) => {
      const row = sheet.addRow([
        index + 1,
        tx.id,
        new Date(tx.created_at).toLocaleString('id-ID'),
        tx.wallet_id,
        tx.type.toUpperCase(),
        tx.amount,
        tx.description,
      ]);

      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle' };
        if (colNumber === 6) {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        if (colNumber === 1 || colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    sheet.columns = [
      { width: 6 },
      { width: 22 },
      { width: 22 },
      { width: 24 },
      { width: 16 },
      { width: 20 },
      { width: 34 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const exportService = new ExportService();
