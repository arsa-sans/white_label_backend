"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// Auth routes — implemented in Phase 2
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map