import { Repository } from '../../shared/repository.js';
import { League } from './league.entity.js';

const leagues = [
    new League(
    "sample",
    "sample",
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class LeagueRepository implements Repository<League> {

    public findAll(): League[] | undefined {
        return leagues;
    }

    public findOne(item: { id: string; }): League | undefined {
        return leagues.find(i => i.id === item.id);
    }

    public add(item: League): League | undefined {
        leagues.push(item);
        return item;
    }

    public update(item: League): League | undefined {
        const index = leagues.findIndex(i => i.id === item.id);
        if (index !== -1) {
            leagues[index] = {...leagues[index], ...item};
        }
        return leagues[index];
    }

    public delete(item: { id: string; }): League | undefined {
        const index = leagues.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = leagues[index];
            leagues.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
