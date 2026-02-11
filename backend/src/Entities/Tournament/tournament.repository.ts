import { Repository } from '../../shared/repository.js';
import { Tournament } from './tournament.entity.js';

const tournaments = [
    new Tournament(
    "sample",
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    0,
    0,
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class TournamentRepository implements Repository<Tournament> {

    public findAll(): Tournament[] | undefined {
        return tournaments;
    }

    public findOne(item: { id: string; }): Tournament | undefined {
        return tournaments.find(i => i.id === item.id);
    }

    public add(item: Tournament): Tournament | undefined {
        tournaments.push(item);
        return item;
    }

    public update(item: Tournament): Tournament | undefined {
        const index = tournaments.findIndex(i => i.id === item.id);
        if (index !== -1) {
            tournaments[index] = {...tournaments[index], ...item};
        }
        return tournaments[index];
    }

    public delete(item: { id: string; }): Tournament | undefined {
        const index = tournaments.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = tournaments[index];
            tournaments.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
