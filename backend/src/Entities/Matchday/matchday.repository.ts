import { Repository } from '../../shared/repository.js';
import { Matchday } from './matchday.entity.js';

const matchdays = [
    new Matchday(
    "sample",
    "sample",
    0,
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class MatchdayRepository implements Repository<Matchday> {

    public findAll(): Matchday[] | undefined {
        return matchdays;
    }

    public findOne(item: { id: string; }): Matchday | undefined {
        return matchdays.find(i => i.id === item.id);
    }

    public add(item: Matchday): Matchday | undefined {
        matchdays.push(item);
        return item;
    }

    public update(item: Matchday): Matchday | undefined {
        const index = matchdays.findIndex(i => i.id === item.id);
        if (index !== -1) {
            matchdays[index] = {...matchdays[index], ...item};
        }
        return matchdays[index];
    }

    public delete(item: { id: string; }): Matchday | undefined {
        const index = matchdays.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = matchdays[index];
            matchdays.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
