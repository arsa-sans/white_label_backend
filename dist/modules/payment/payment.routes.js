"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => res.json({ module: 'payment', status: 'ok' }));
exports.default = router;
//# sourceMappingURL=payment.routes.js.map