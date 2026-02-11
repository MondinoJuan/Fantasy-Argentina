import { Repository } from '../../shared/repository.js';
import { Bid } from './bid.entity.js';

const bids = [
    new Bid(
    "sample",
    "sample",
    0,
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class BidRepository implements Repository<Bid> {

    public findAll(): Bid[] | undefined {
        return bids;
    }

    public findOne(item: { id: string; }): Bid | undefined {
        return bids.find(i => i.id === item.id);
    }

    public add(item: Bid): Bid | undefined {
        bids.push(item);
        return item;
    }

    public update(item: Bid): Bid | undefined {
        const index = bids.findIndex(i => i.id === item.id);
        if (index !== -1) {
            bids[index] = {...bids[index], ...item};
        }
        return bids[index];
    }

    public delete(item: { id: string; }): Bid | undefined {
        const index = bids.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = bids[index];
            bids.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
