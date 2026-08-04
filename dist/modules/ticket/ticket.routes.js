"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_controller_1 = require("./ticket.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/lock-seat', auth_middleware_1.authenticate, ticket_controller_1.lockSeat);
router.get('/my-tickets', auth_middleware_1.authenticate, ticket_controller_1.getMyTickets);
router.get('/:id/qr-token', auth_middleware_1.authenticate, ticket_controller_1.getDynamicQrToken);
exports.default = router;
//# sourceMappingURL=ticket.routes.js.map