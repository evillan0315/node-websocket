"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHELL_DEFAULT = exports.PORT = exports.BASE_DIR = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.BASE_DIR = process.env.BASE_DIR || ''; // Use empty string for root, or '/app' etc.
exports.PORT = parseInt(process.env.PORT || '3000', 10);
exports.SHELL_DEFAULT = process.env.SHELL_DEFAULT || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
