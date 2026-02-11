import { Repository } from '../../shared/repository.js';
import { MatchdayMarket } from './matchdayMarket.entity.js';

const matchdayMarkets = [
    new MatchdayMarket(
    "sample",
    "sample",
    "sample",
    0,
    "sample",
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class MatchdayMarketRepository implements Repository<MatchdayMarket> {

    public findAll(): MatchdayMarket[] | undefined {
        return matchdayMarkets;
    }

    public findOne(item: { id: string; }): MatchdayMarket | undefined {
        return matchdayMarkets.find(i => i.id === item.id);
    }

    public add(item: MatchdayMarket): MatchdayMarket | undefined {
        matchdayMarkets.push(item);
        return item;
    }

    public update(item: MatchdayMarket): MatchdayMarket | undefined {
        const index = matchdayMarkets.findIndex(i => i.id === item.id);
        if (index !== -1) {
            matchdayMarkets[index] = {...matchdayMarkets[index], ...item};
        }
        return matchdayMarkets[index];
    }

    public delete(item: { id: string; }): MatchdayMarket | undefined {
        const index = matchdayMarkets.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = matchdayMarkets[index];
            matchdayMarkets.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
