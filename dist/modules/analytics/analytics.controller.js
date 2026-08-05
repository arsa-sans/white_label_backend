"use strict";
/**
 * src/modules/analytics/analytics.controller.ts
 *
 * FASE 10 — Analytics & Organizer Dashboard
 *
 * Real-time aggregations & Payout settlement flow:
 *   1. getDashboardMetrics → GET /analytics/dashboard (real-time revenue, occupancy %, gate check-in %)
 *   2. getOccupancyReport  → GET /analytics/occupancy (category seat breakdown)
 *   3. getGateThroughput   → GET /analytics/gate-throughput (scans per hour breakdown)
 *   4. requestPayout       → POST /analytics/payouts/request (organizer requests revenue payout)
 *   5. getPayouts          → GET /analytics/payouts (list payout requests)
 *   6. updatePayoutStatus  → PUT /analytics/payouts/:id/status (admin approve/pay: requested → approved → paid)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutStore = void 0;
exports.getDashboardMetrics = getDashboardMetrics;
exports.getOccupancyReport = getOccupancyReport;
exports.getGateThroughput = getGateThroughput;
exports.requestPayout = requestPayout;
exports.getPayouts = getPayouts;
exports.updatePayoutStatus = updatePayoutStatus;
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
const logger_1 = require("../../utils/logger");
// In-Memory Payout Store
exports.payoutStore = [
    {
        id: 'pay-001',
        tenant_id: 'tenant-001',
        organizer_id: 'user-organizer-1',
        event_id: 'evt-001',
        amount: 150000000,
        bank_name: 'BCA',
        account_number: '8820194821',
        account_holder: 'PT Elena Media Utama',
        status: 'paid',
        requested_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        processed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
];
// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/dashboard
// Query: event_id?
// Auth: authenticate (organizer, admin, superadmin)
// ─────────────────────────────────────────────────────────────────────────────
async function getDashboardMetrics(req, res) {
    const event_id = req.query.event_id;
    let events = dataStore_1.dataStore.events;
    let seats = dataStore_1.dataStore.seats;
    let tickets = dataStore_1.dataStore.tickets;
    let orders = dataStore_1.dataStore.orders.filter((o) => o.status === 'paid');
    if (event_id) {
        events = events.filter((e) => e.id === event_id);
        seats = seats.filter((s) => s.event_id === event_id);
        tickets = tickets.filter((t) => t.event_id === event_id);
        orders = orders.filter((o) => o.event_id === event_id);
    }
    const totalEvents = events.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const totalTicketsSold = tickets.length;
    const totalScanned = tickets.filter((t) => t.status === 'used').length;
    const totalSeatsCount = seats.length;
    const soldSeatsCount = seats.filter((s) => s.status === 'sold').length;
    const occupancyRate = totalSeatsCount > 0 ? Number(((soldSeatsCount / totalSeatsCount) * 100).toFixed(1)) : 0;
    const checkinRate = totalTicketsSold > 0 ? Number(((totalScanned / totalTicketsSold) * 100).toFixed(1)) : 0;
    // Category breakdown
    const categoryMap = {};
    for (const s of seats) {
        if (!categoryMap[s.category]) {
            categoryMap[s.category] = { category: s.category, total: 0, sold: 0, revenue: 0 };
        }
        categoryMap[s.category].total++;
        if (s.status === 'sold') {
            categoryMap[s.category].sold++;
            categoryMap[s.category].revenue += s.price;
        }
    }
    const categoryBreakdown = Object.values(categoryMap);
    res.json(apiResponse_1.ApiResponse.success({
        total_revenue: totalRevenue,
        total_tickets_sold: totalTicketsSold,
        total_events: totalEvents,
        total_scanned: totalScanned,
        occupancy_rate_percent: occupancyRate,
        checkin_rate_percent: checkinRate,
        category_breakdown: categoryBreakdown,
        recent_orders: orders.slice(-5).reverse(),
        recent_scan_logs: dataStore_1.dataStore.gateScanLogs.slice(-5).reverse(),
    }, 'Organizer dashboard metrics retrieved successfully'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/occupancy
// Query: event_id?
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function getOccupancyReport(req, res) {
    const event_id = req.query.event_id || 'evt-001';
    const seats = dataStore_1.dataStore.seats.filter((s) => s.event_id === event_id);
    const totalSeats = seats.length;
    const soldSeats = seats.filter((s) => s.status === 'sold').length;
    const lockedSeats = seats.filter((s) => s.status === 'locked').length;
    const availableSeats = seats.filter((s) => s.status === 'available').length;
    res.json(apiResponse_1.ApiResponse.success({
        event_id,
        total_seats: totalSeats,
        sold_seats: soldSeats,
        locked_seats: lockedSeats,
        available_seats: availableSeats,
        occupancy_percentage: totalSeats > 0 ? Number(((soldSeats / totalSeats) * 100).toFixed(1)) : 0,
    }, 'Event seat occupancy report retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/gate-throughput
// Query: event_id?
// Auth: authenticate
// ─────────────────────────────────────────────────────────────────────────────
async function getGateThroughput(req, res) {
    const logs = dataStore_1.dataStore.gateScanLogs;
    // Hourly scan count aggregation
    const hourlyMap = {};
    for (const l of logs) {
        const hourKey = l.scanned_at.substring(0, 13) + ':00'; // YYYY-MM-DDTHH:00
        hourlyMap[hourKey] = (hourlyMap[hourKey] || 0) + 1;
    }
    const chartData = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }));
    res.json(apiResponse_1.ApiResponse.success({
        total_scans: logs.length,
        throughput_hourly: chartData,
    }, 'Gate throughput analytics retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /analytics/payouts/request
// Body: { event_id, amount, bank_name, account_number, account_holder }
// Auth: requireRole(['organizer', 'admin', 'superadmin'])
// ─────────────────────────────────────────────────────────────────────────────
async function requestPayout(req, res) {
    const { event_id, amount, bank_name, account_number, account_holder } = req.body;
    const organizerId = req.user?.userId;
    if (!event_id || !amount || typeof amount !== 'number' || amount <= 0 || !bank_name || !account_number || !account_holder) {
        res.status(400).json(apiResponse_1.ApiResponse.error('event_id, positive amount, bank_name, account_number, and account_holder are required', 400));
        return;
    }
    // Calculate available organizer balance for this event
    const eventOrders = dataStore_1.dataStore.orders.filter((o) => o.event_id === event_id && o.status === 'paid');
    const totalRevenue = eventOrders.reduce((sum, o) => sum + o.amount, 0);
    const existingPayouts = exports.payoutStore.filter((p) => p.event_id === event_id && (p.status === 'requested' || p.status === 'approved' || p.status === 'paid'));
    const alreadyRequestedAmount = existingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const availablePayoutBalance = totalRevenue - alreadyRequestedAmount;
    if (amount > availablePayoutBalance) {
        res.status(400).json(apiResponse_1.ApiResponse.error(`Requested amount Rp ${amount.toLocaleString('id-ID')} exceeds available payout balance Rp ${availablePayoutBalance.toLocaleString('id-ID')}`, 400));
        return;
    }
    const payoutReq = {
        id: `pay-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
        tenant_id: req.user?.tenantId || 'tenant-001',
        organizer_id: organizerId,
        event_id,
        amount,
        bank_name,
        account_number,
        account_holder,
        status: 'requested',
        requested_at: new Date().toISOString(),
    };
    exports.payoutStore.unshift(payoutReq);
    logger_1.logger.info(`[Analytics/Payout] Organizer ${organizerId} requested payout of Rp ${amount} for event ${event_id}`);
    res.status(201).json(apiResponse_1.ApiResponse.success(payoutReq, 'Payout request submitted successfully. Awaiting platform admin review.'));
}
// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/payouts
// Auth: authenticate (organizer, admin, superadmin)
// ─────────────────────────────────────────────────────────────────────────────
async function getPayouts(req, res) {
    const userId = req.user?.userId;
    const role = req.user?.role;
    let payouts = exports.payoutStore;
    if (role === 'organizer') {
        payouts = payouts.filter((p) => p.organizer_id === userId);
    }
    res.json(apiResponse_1.ApiResponse.success(payouts, 'Payout requests retrieved'));
}
// ─────────────────────────────────────────────────────────────────────────────
// PUT /analytics/payouts/:id/status
// Body: { status: 'approved' | 'paid' | 'rejected' }
// Auth: requireRole(['admin', 'superadmin'])
// Flow: requested → approved → paid
// ─────────────────────────────────────────────────────────────────────────────
async function updatePayoutStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'paid', 'rejected'].includes(status)) {
        res.status(400).json(apiResponse_1.ApiResponse.error("Status must be 'approved', 'paid', or 'rejected'", 400));
        return;
    }
    const payout = exports.payoutStore.find((p) => p.id === id);
    if (!payout) {
        res.status(404).json(apiResponse_1.ApiResponse.error('Payout request not found', 404));
        return;
    }
    payout.status = status;
    if (status === 'paid') {
        payout.processed_at = new Date().toISOString();
    }
    logger_1.logger.info(`[Analytics/Payout] Payout ${id} status updated to '${status}' by admin ${req.user?.userId}`);
    res.json(apiResponse_1.ApiResponse.success(payout, `Payout status updated to '${status}' successfully`));
}
//# sourceMappingURL=analytics.controller.js.map