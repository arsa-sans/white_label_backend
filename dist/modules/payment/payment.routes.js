"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("./payment.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/orders', auth_middleware_1.authenticate, payment_controller_1.createOrder);
router.post('/orders/:id/pay', auth_middleware_1.authenticate, payment_controller_1.processPayment);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map