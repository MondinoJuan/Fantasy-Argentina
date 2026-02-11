import { Repository } from '../../shared/repository.js';
import { Transaction } from './transaction.entity.js';

const transactions = [
    new Transaction(
    "sample",
    "sample",
    "sample",
    "sample",
    0,
    "sample",
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class TransactionRepository implements Repository<Transaction> {

    public findAll(): Transaction[] | undefined {
        return transactions;
    }

    public findOne(item: { id: string; }): Transaction | undefined {
        return transactions.find(i => i.id === item.id);
    }

    public add(item: Transaction): Transaction | undefined {
        transactions.push(item);
        return item;
    }

    public update(item: Transaction): Transaction | undefined {
        const index = transactions.findIndex(i => i.id === item.id);
        if (index !== -1) {
            transactions[index] = {...transactions[index], ...item};
        }
        return transactions[index];
    }

    public delete(item: { id: string; }): Transaction | undefined {
        const index = transactions.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = transactions[index];
            transactions.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
