import { Repository } from '../../shared/repository.js';
import { Shielding } from './shielding.entity.js';

const shieldings = [
    new Shielding(
    "sample",
    "sample",
    0,
    0,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class ShieldingRepository implements Repository<Shielding> {

    public findAll(): Shielding[] | undefined {
        return shieldings;
    }

    public findOne(item: { id: string; }): Shielding | undefined {
        return shieldings.find(i => i.id === item.id);
    }

    public add(item: Shielding): Shielding | undefined {
        shieldings.push(item);
        return item;
    }

    public update(item: Shielding): Shielding | undefined {
        const index = shieldings.findIndex(i => i.id === item.id);
        if (index !== -1) {
            shieldings[index] = {...shieldings[index], ...item};
        }
        return shieldings[index];
    }

    public delete(item: { id: string; }): Shielding | undefined {
        const index = shieldings.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = shieldings[index];
            shieldings.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
