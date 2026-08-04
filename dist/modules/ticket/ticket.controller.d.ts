import { Request, Response } from 'express';
export declare function lockSeat(req: Request, res: Response): Promise<void>;
export declare function getMyTickets(req: Request, res: Response): Promise<void>;
/**
 * Generate Dynamic QR Token
 * Rotates every 30 seconds based on qr_seed + timestamp window
 */
export declare function getDynamicQrToken(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=ticket.controller.d.ts.map