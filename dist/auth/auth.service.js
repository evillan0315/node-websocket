"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
class AuthService {
    validateToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
            // Basic validation: ensure sub and roles exist
            if (payload && payload.sub && Array.isArray(payload.roles)) {
                return payload;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
}
exports.AuthService = AuthService;
