/**
 * src/config/db.ts
 * Sequelize instance — shared across all modules.
 * Models are registered in each module's model file.
 */
import { Sequelize } from 'sequelize';
export declare const sequelize: Sequelize;
export declare function connectDB(): Promise<void>;
//# sourceMappingURL=db.d.ts.map