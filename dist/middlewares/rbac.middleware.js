"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const apiResponse_1 = require("../utils/apiResponse");
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json(apiResponse_1.ApiResponse.error('Authentication required', 401));
            return;
        }
        const userRole = req.user.role;
        // superadmin bypasses all role checks
        if (userRole === 'superadmin') {
            next();
            return;
        }
        if (!allowedRoles.includes(userRole)) {
            res.status(403).json(apiResponse_1.ApiResponse.error(`Access denied. Required roles: ${allowedRoles.join(', ')}`, 403));
            return;
        }
        next();
    };
}
//# sourceMappingURL=rbac.middleware.js.map