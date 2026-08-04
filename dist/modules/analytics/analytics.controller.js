"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardMetrics = getDashboardMetrics;
const dataStore_1 = require("../../database/dataStore");
const apiResponse_1 = require("../../utils/apiResponse");
async function getDashboardMetrics(_req, res) {
    const totalEvents = dataStore_1.dataStore.events.length;
    const totalOrders = dataStore_1.dataStore.orders.filter((o) => o.status === 'paid');
    const totalRevenue = totalOrders.reduce((sum, o) => sum + o.amount, 0);
    const totalTicketsSold = dataStore_1.dataStore.tickets.length;
    const totalScanned = dataStore_1.dataStore.tickets.filter((t) => t.status === 'used').length;
    const totalSeatsCount = dataStore_1.dataStore.seats.length;
    const soldSeatsCount = dataStore_1.dataStore.seats.filter((s) => s.status === 'sold').length;
    const occupancyRate = totalSeatsCount > 0 ? ((soldSeatsCount / totalSeatsCount) * 100).toFixed(1) : 0;
    const checkinRate = totalTicketsSold > 0 ? ((totalScanned / totalTicketsSold) * 100).toFixed(1) : 0;
    res.json(apiResponse_1.ApiResponse.success({
        total_revenue: totalRevenue,
        total_tickets_sold: totalTicketsSold,
        total_events: totalEvents,
        total_scanned: totalScanned,
        occupancy_rate_percent: Number(occupancyRate),
        checkin_rate_percent: Number(checkinRate),
        recent_orders: dataStore_1.dataStore.orders.slice(-5).reverse(),
        gate_scan_logs_recent: dataStore_1.dataStore.gateScanLogs.slice(-5).reverse(),
    }, 'Organizer dashboard metrics retrieved'));
}
//# sourceMappingURL=analytics.controller.js.map