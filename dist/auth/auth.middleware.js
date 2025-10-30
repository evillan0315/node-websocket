"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesMiddleware = exports.authMiddleware = void 0;
const auth_service_1 = require("./auth.service");
const authService = new auth_service_1.AuthService();
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const user = authService.validateToken(token);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    req.user = user;
    next();
};
exports.authMiddleware = authMiddleware;
const rolesMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated' });
        }
        if (!allowedRoles.some(role => req.user?.roles.includes(role))) {
            return res.status(403).json({ message: 'Forbidden: Insufficient roles' });
        }
        next();
    };
};
exports.rolesMiddleware = rolesMiddleware;
