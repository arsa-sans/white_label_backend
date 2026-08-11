import { DemoUser } from '../../database/dataStore';
export declare class AuthRepository {
    findByEmail(email: string): Promise<DemoUser | undefined>;
    findById(id: string): Promise<DemoUser | undefined>;
    create(user: DemoUser): Promise<DemoUser>;
}
export declare const authRepository: AuthRepository;
//# sourceMappingURL=auth.repository.d.ts.map