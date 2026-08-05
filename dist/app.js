"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const tenant_middleware_1 = require("./middlewares/tenant.middleware");
const errorHandler_middleware_1 = require("./middlewares/errorHandler.middleware");
const apiResponse_1 = require("./utils/apiResponse");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const event_routes_1 = __importDefault(require("./modules/event/event.routes"));
const ticket_routes_1 = __importDefault(require("./modules/ticket/ticket.routes"));
const payment_routes_1 = __importDefault(require("./modules/payment/payment.routes"));
const cashless_routes_1 = __importDefault(require("./modules/cashless/cashless.routes"));
const gate_routes_1 = __importDefault(require("./modules/gate/gate.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const app = (0, express_1.default)();
// Security & Parsing Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., curl, Postman) and localhost dev origins
        const allowed = [
            env_1.env.CORS_ORIGIN,
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-idempotency-key',
        'Idempotency-Key',
        'x-tenant-id',
        'x-webhook-secret',
    ],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
if (env_1.env.isDev) {
    app.use((0, morgan_1.default)('dev'));
}
// Serve static uploads
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Global Health Check (bypasses tenant resolution)
app.get('/health', (_req, res) => {
    res.json(apiResponse_1.ApiResponse.success({ status: 'online', uptime: process.uptime(), timestamp: new Date().toISOString() }, 'White Label Backend API Operational'));
});
// Modular Monolith API Routes (Tenant resolution applied)
const apiRouter = express_1.default.Router();
apiRouter.use(tenant_middleware_1.resolveTenant);
apiRouter.use('/auth', auth_routes_1.default);
apiRouter.use('/events', event_routes_1.default);
apiRouter.use('/tickets', ticket_routes_1.default);
apiRouter.use('/payments', payment_routes_1.default);
apiRouter.use('/cashless', cashless_routes_1.default);
apiRouter.use('/gate', gate_routes_1.default);
apiRouter.use('/notifications', notification_routes_1.default);
apiRouter.use('/analytics', analytics_routes_1.default);
app.use('/api/v1', apiRouter);
// Global Error Handler
app.use(errorHandler_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map