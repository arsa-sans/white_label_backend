import { dataStore, DemoUser } from '../../database/dataStore';

export class AuthRepository {
  async findByEmail(email: string): Promise<DemoUser | undefined> {
    return dataStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async findById(id: string): Promise<DemoUser | undefined> {
    return dataStore.users.find((u) => u.id === id);
  }

  async create(user: DemoUser): Promise<DemoUser> {
    dataStore.users.push(user);
    return user;
  }
}

export const authRepository = new AuthRepository();
