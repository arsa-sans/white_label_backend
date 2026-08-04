"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashless_controller_1 = require("./cashless.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/wallet', auth_middleware_1.authenticate, cashless_controller_1.getWallet);
router.post('/topup', auth_middleware_1.authenticate, cashless_controller_1.topupWallet);
exports.default = router;
//# sourceMappingURL=cashless.routes.js.map