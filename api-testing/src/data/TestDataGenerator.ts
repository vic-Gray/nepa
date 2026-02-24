import faker from 'faker';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { APITestConfig } from '../types/config';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  name: string;
  password: string;
  hashedPassword: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestBill {
  id: string;
  userId: string;
  utilityType: 'electricity' | 'water';
  provider: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue';
  meterNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPayment {
  id: string;
  billId: string;
  userId: string;
  amount: number;
  method: 'stellar' | 'card' | 'bank';
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export class TestDataGenerator {
  private config: APITestConfig;
  private users: TestUser[] = [];
  private bills: TestBill[] = [];
  private payments: TestPayment[] = [];

  constructor(config: APITestConfig) {
    this.config = config;
  }

  generateUser(overrides: Partial<TestUser> = {}): TestUser {
    const password = faker.internet.password(12, true, /[A-Z]/);
    const user: TestUser = {
      id: uuidv4(),
      email: faker.internet.email(),
      username: faker.internet.userName(),
      name: `${faker.name.firstName()} ${faker.name.lastName()}`,
      password,
      hashedPassword: bcrypt.hashSync(password, 10),
      phone: faker.phone.number(),
      address: faker.address.streetAddress(),
      isActive: true,
      isVerified: faker.datatype.boolean(),
      createdAt: faker.date.past(),
      updatedAt: new Date(),
      ...overrides,
    };

    this.users.push(user);
    return user;
  }

  generateBill(userId: string, overrides: Partial<TestBill> = {}): TestBill {
    const bill: TestBill = {
      id: uuidv4(),
      userId,
      utilityType: faker.helpers.arrayElement(['electricity', 'water']),
      provider: faker.company.companyName(),
      amount: parseFloat(faker.datatype.number({ min: 1000, max: 50000, precision: 0.01 }).toString()),
      dueDate: faker.date.future(),
      status: faker.helpers.arrayElement(['pending', 'paid', 'overdue']),
      meterNumber: faker.datatype.string(10),
      createdAt: faker.date.past(),
      updatedAt: new Date(),
      ...overrides,
    };

    this.bills.push(bill);
    return bill;
  }

  generatePayment(billId: string, userId: string, overrides: Partial<TestPayment> = {}): TestPayment {
    const bill = this.bills.find(b => b.id === billId);
    const payment: TestPayment = {
      id: uuidv4(),
      billId,
      userId,
      amount: bill?.amount || parseFloat(faker.datatype.number({ min: 1000, max: 50000, precision: 0.01 }).toString()),
      method: faker.helpers.arrayElement(['stellar', 'card', 'bank']),
      transactionId: faker.datatype.uuid(),
      status: faker.helpers.arrayElement(['pending', 'completed', 'failed']),
      createdAt: faker.date.past(),
      updatedAt: new Date(),
      ...overrides,
    };

    this.payments.push(payment);
    return payment;
  }

  generateAuthToken(user: TestUser): string {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h',
    });
  }

  generateRefreshToken(user: TestUser): string {
    const payload = {
      id: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'test-refresh-secret', {
      expiresIn: '7d',
    });
  }

  generateMultipleUsers(count: number): TestUser[] {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i++) {
      users.push(this.generateUser());
    }
    return users;
  }

  generateMultipleBills(userId: string, count: number): TestBill[] {
    const bills: TestBill[] = [];
    for (let i = 0; i < count; i++) {
      bills.push(this.generateBill(userId));
    }
    return bills;
  }

  generateTestData(): {
    users: TestUser[];
    bills: TestBill[];
    payments: TestPayment[];
  } {
    const users = this.generateMultipleUsers(10);
    const bills: TestBill[] = [];
    const payments: TestPayment[] = [];

    users.forEach(user => {
      const userBills = this.generateMultipleBills(user.id, faker.datatype.number({ min: 1, max: 5 }));
      bills.push(...userBills);

      userBills.forEach(bill => {
        if (faker.datatype.boolean()) {
          const payment = this.generatePayment(bill.id, user.id);
          payments.push(payment);
        }
      });
    });

    return { users, bills, payments };
  }

  getUsers(): TestUser[] {
    return this.users;
  }

  getBills(): TestBill[] {
    return this.bills;
  }

  getPayments(): TestPayment[] {
    return this.payments;
  }

  getUserById(id: string): TestUser | undefined {
    return this.users.find(user => user.id === id);
  }

  getUserByEmail(email: string): TestUser | undefined {
    return this.users.find(user => user.email === email);
  }

  getBillsByUserId(userId: string): TestBill[] {
    return this.bills.filter(bill => bill.userId === userId);
  }

  getPaymentsByUserId(userId: string): TestPayment[] {
    return this.payments.filter(payment => payment.userId === userId);
  }

  clearData(): void {
    this.users = [];
    this.bills = [];
    this.payments = [];
  }

  generateRandomString(length: number = 10): string {
    return faker.datatype.string(length);
  }

  generateRandomEmail(): string {
    return faker.internet.email();
  }

  generateRandomPhoneNumber(): string {
    return faker.phone.number();
  }

  generateRandomAddress(): string {
    return faker.address.streetAddress();
  }

  generateRandomAmount(min: number = 1000, max: number = 50000): number {
    return parseFloat(faker.datatype.number({ min, max, precision: 0.01 }).toString());
  }
}
