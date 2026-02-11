import { Repository } from '../../shared/repository.js';
import { Negotiation } from './negotiation.entity.js';

const negotiations = [
    new Negotiation(
    "sample",
    "sample",
    "sample",
    "sample",
    0,
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class NegotiationRepository implements Repository<Negotiation> {

    public findAll(): Negotiation[] | undefined {
        return negotiations;
    }

    public findOne(item: { id: string; }): Negotiation | undefined {
        return negotiations.find(i => i.id === item.id);
    }

    public add(item: Negotiation): Negotiation | undefined {
        negotiations.push(item);
        return item;
    }

    public update(item: Negotiation): Negotiation | undefined {
        const index = negotiations.findIndex(i => i.id === item.id);
        if (index !== -1) {
            negotiations[index] = {...negotiations[index], ...item};
        }
        return negotiations[index];
    }

    public delete(item: { id: string; }): Negotiation | undefined {
        const index = negotiations.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = negotiations[index];
            negotiations.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
