"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("./analytics.controller");
const router = (0, express_1.Router)();
router.get('/dashboard', analytics_controller_1.getDashboardMetrics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map