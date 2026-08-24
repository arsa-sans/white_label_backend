/**
 * src/modules/ticket/ticket-pdf.service.ts
 *
 * High-resolution e-ticket PDF generator using PDFKit and QRCode.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { dataStore } from '../../database/dataStore';
import { generateTicketQrPayload } from './ticket.service';

export async function generateTicketPdf(ticketId: string, tenantId: string): Promise<Buffer> {
  const ticket = dataStore.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    throw new Error(`Tiket dengan ID ${ticketId} tidak ditemukan.`);
  }

  const event = dataStore.events.find((e) => e.id === ticket.event_id);
  const tier = dataStore.ticketTiers.find((t) => t.id === ticket.tier_id);
  const user = dataStore.users.find((u) => u.id === ticket.user_id);
  const tenant = dataStore.tenants.find((tn) => tn.id === tenantId) || dataStore.tenants[0];

  // Generate dynamic QR Code buffer
  const qrPayload = generateTicketQrPayload(ticket.id, ticket.event_id, ticket.qr_seed);
  const qrBuffer = await QRCode.toBuffer(qrPayload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 250,
    color: {
      dark: '#1E1B4B',
      light: '#FFFFFF',
    },
  });

  return new Promise((resolve, reject) => {
    try {
      // Landscape Ticket format: 600 x 280 pt (approx 21cm x 10cm standard concert pass)
      const doc = new PDFDocument({
        size: [600, 280],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // ── Background & Left Accent Header ──────────────────────────────────────
      doc.rect(0, 0, 600, 280).fill('#0F172A'); // Slate 900 base

      // Left Accent Strip (Tier color representation)
      const accentColor = tier?.color || '#6366F1';
      doc.rect(0, 0, 10, 280).fill(accentColor);

      // Top Branded Header Bar
      doc.rect(10, 0, 590, 42).fill('#1E293B');

      // Tenant & Platform Branding
      doc
        .fillColor('#94A3B8')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('OFFICIAL E-TICKET PASS  •  WHITELABEL EVENT PLATFORM', 25, 14, { characterSpacing: 1 });

      doc
        .fillColor(accentColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(tenant?.name?.toUpperCase() || 'SOUNDWAVE FESTIVAL', 420, 14, { align: 'right', width: 155 });

      // ── Event Title & Tier Badge ─────────────────────────────────────────────
      doc
        .fillColor('#FFFFFF')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(event?.name || 'Grand Music Event', 25, 54, { width: 370 });

      // Category / Subtitle
      doc
        .fillColor('#94A3B8')
        .fontSize(9)
        .font('Helvetica')
        .text(`${event?.category || 'Concert & Festival'}  |  ${event?.venue_name || 'Main Arena'}`, 25, 75);

      // Tier Badge
      const tierName = ticket.tier_name || tier?.name || 'GENERAL ADMISSION';
      doc.roundedRect(25, 94, 200, 24, 6).fill(accentColor);
      doc
        .fillColor('#FFFFFF')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(tierName.toUpperCase(), 25, 101, { width: 200, align: 'center' });

      // ── Event Date & Venue Details Grid ──────────────────────────────────────
      doc
        .fillColor('#64748B')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('TANGGAL & WAKTU', 25, 130);

      const eventDate = event?.start_date
        ? new Date(event.start_date).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '15 September 2026';

      doc
        .fillColor('#E2E8F0')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(eventDate, 25, 140);

      doc
        .fillColor('#64748B')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('LOKASI / VENUE', 25, 162);

      doc
        .fillColor('#E2E8F0')
        .fontSize(8)
        .font('Helvetica')
        .text(event?.location || 'JIExpo Kemayoran, Jakarta Pusat', 25, 172, { width: 190 });

      // ── Attendee & Order Info ────────────────────────────────────────────────
      doc
        .fillColor('#64748B')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('NAMA PEMEGANG TIKET', 230, 130);

      doc
        .fillColor('#38BDF8')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(user?.name || 'Ticket Holder', 230, 140, { width: 160 });

      doc
        .fillColor('#64748B')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('TICKET ID / ORDER REF', 230, 162);

      doc
        .fillColor('#CBD5E1')
        .fontSize(8)
        .font('Courier-Bold')
        .text(`${ticket.id} (${ticket.order_id})`, 230, 172, { width: 160 });

      // Price Tag
      doc
        .fillColor('#64748B')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('HARGA TIKET', 230, 194);

      doc
        .fillColor('#10B981')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Rp ${ticket.price.toLocaleString('id-ID')}`, 230, 204);

      // ── Perforated Divider Line ──────────────────────────────────────────────
      doc.save();
      doc.strokeColor('#334155').lineWidth(1).dash(4, { space: 4 });
      doc.moveTo(410, 42).lineTo(410, 280).stroke();
      doc.restore();

      // Top & Bottom Notch Cutouts for stub ticket aesthetic
      doc.circle(410, 42, 8).fill('#020617');
      doc.circle(410, 280, 8).fill('#020617');

      // ── Right Pass Stub (QR Code & Gate Scan) ────────────────────────────────
      doc
        .fillColor('#94A3B8')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('GATE SCAN PASS', 420, 54, { align: 'center', width: 160 });

      // Render Dynamic QR Image Buffer
      doc.image(qrBuffer, 435, 72, { width: 130, height: 130 });

      doc
        .fillColor('#64748B')
        .fontSize(6.5)
        .font('Helvetica')
        .text('Pindai QR ini pada scanner pintu masuk', 420, 208, {
          align: 'center',
          width: 160,
        });

      // Verification Seed at Bottom Right
      doc
        .fillColor('#475569')
        .fontSize(6)
        .font('Courier')
        .text(`SEC: ${ticket.qr_seed.slice(0, 16).toUpperCase()}`, 420, 222, {
          align: 'center',
          width: 160,
        });

      // Status Badge
      const statusText = ticket.status === 'valid' ? '✓ TIKET VALID' : ticket.status.toUpperCase();
      const statusColor = ticket.status === 'valid' ? '#059669' : '#DC2626';
      doc.roundedRect(445, 236, 110, 18, 4).fill(statusColor);
      doc
        .fillColor('#FFFFFF')
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .text(statusText, 445, 241, { width: 110, align: 'center' });

      // ── Footer Notice on Left ────────────────────────────────────────────────
      doc
        .fillColor('#475569')
        .fontSize(6.5)
        .font('Helvetica')
        .text(
          'Dilarang memperbanyak atau membagikan e-tiket ini kepada pihak ketiga. Hak cipta & otentikasi dilindungi sistem.',
          25,
          250,
          { width: 360 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
