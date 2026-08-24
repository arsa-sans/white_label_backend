import { exportService } from '../export.service';
import { generateTicketPdf } from '../../ticket/ticket-pdf.service';

describe('Export & PDF Services', () => {
  it('should generate sales report Excel buffer successfully', async () => {
    const buffer = await exportService.generateSalesReport('tenant-001');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // Valid xlsx zip archive
  });

  it('should generate gate log report Excel buffer successfully', async () => {
    const buffer = await exportService.generateGateLogReport('tenant-001');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('should generate booth transactions report Excel buffer successfully', async () => {
    const buffer = await exportService.generateBoothTransactionReport('tenant-001');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('should generate e-ticket PDF buffer successfully', async () => {
    const buffer = await generateTicketPdf('tkt-demo-101', 'tenant-001');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // Valid PDF document
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });
});
