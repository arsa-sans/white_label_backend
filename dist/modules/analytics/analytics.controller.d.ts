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
import { Request, Response } from 'express';
export interface DemoPayoutRequest {
    id: string;
    tenant_id: string;
    organizer_id: string;
    event_id: string;
    amount: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    status: 'requested' | 'approved' | 'paid' | 'rejected';
    requested_at: string;
    processed_at?: string;
}
export declare const payoutStore: DemoPayoutRequest[];
export declare function getDashboardMetrics(req: Request, res: Response): Promise<void>;
export declare function getOccupancyReport(req: Request, res: Response): Promise<void>;
export declare function getGateThroughput(req: Request, res: Response): Promise<void>;
export declare function requestPayout(req: Request, res: Response): Promise<void>;
export declare function getPayouts(req: Request, res: Response): Promise<void>;
export declare function updatePayoutStatus(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=analytics.controller.d.ts.map