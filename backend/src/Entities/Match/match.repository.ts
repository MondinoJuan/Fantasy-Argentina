import { Repository } from '../../shared/repository.js';
import { Match } from './match.entity.js';

const matchs = [
    new Match(
    "sample",
    "sample",
    "sample",
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class MatchRepository implements Repository<Match> {

    public findAll(): Match[] | undefined {
        return matchs;
    }

    public findOne(item: { id: string; }): Match | undefined {
        return matchs.find(i => i.id === item.id);
    }

    public add(item: Match): Match | undefined {
        matchs.push(item);
        return item;
    }

    public update(item: Match): Match | undefined {
        const index = matchs.findIndex(i => i.id === item.id);
        if (index !== -1) {
            matchs[index] = {...matchs[index], ...item};
        }
        return matchs[index];
    }

    public delete(item: { id: string; }): Match | undefined {
        const index = matchs.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = matchs[index];
            matchs.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
