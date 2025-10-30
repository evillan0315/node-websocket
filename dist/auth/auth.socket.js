"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSocketMiddleware = void 0;
const auth_service_1 = require("./auth.service");
const authService = new auth_service_1.AuthService();
const authSocketMiddleware = async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error('Authentication error: Missing token'));
    }
    const user = authService.validateToken(token.replace('Bearer ', '').trim());
    if (!user) {
        return next(new Error('Authentication error: Invalid token'));
    }
    socket.userId = user.sub;
    socket.roles = user.roles;
    next();
};
exports.authSocketMiddleware = authSocketMiddleware;
