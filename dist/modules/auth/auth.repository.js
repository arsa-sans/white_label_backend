"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRepository = exports.AuthRepository = void 0;
const dataStore_1 = require("../../database/dataStore");
class AuthRepository {
    async findByEmail(email) {
        return dataStore_1.dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
    async findById(id) {
        return dataStore_1.dataStore.users.find((u) => u.id === id);
    }
    async create(user) {
        dataStore_1.dataStore.users.push(user);
        return user;
    }
}
exports.AuthRepository = AuthRepository;
exports.authRepository = new AuthRepository();
//# sourceMappingURL=auth.repository.js.map