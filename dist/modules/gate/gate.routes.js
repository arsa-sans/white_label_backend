"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gate_controller_1 = require("./gate.controller");
const router = (0, express_1.Router)();
router.post('/validate', gate_controller_1.validateGateScan);
router.post('/sync-logs', gate_controller_1.syncGateLogs);
exports.default = router;
//# sourceMappingURL=gate.routes.js.map