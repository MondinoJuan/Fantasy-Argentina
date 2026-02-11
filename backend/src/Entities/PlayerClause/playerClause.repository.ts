import { Repository } from '../../shared/repository.js';
import { PlayerClause } from './playerClause.entity.js';

const playerClauses = [
    new PlayerClause(
    "sample",
    "sample",
    "sample",
    0,
    0,
    0,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class PlayerClauseRepository implements Repository<PlayerClause> {

    public findAll(): PlayerClause[] | undefined {
        return playerClauses;
    }

    public findOne(item: { id: string; }): PlayerClause | undefined {
        return playerClauses.find(i => i.id === item.id);
    }

    public add(item: PlayerClause): PlayerClause | undefined {
        playerClauses.push(item);
        return item;
    }

    public update(item: PlayerClause): PlayerClause | undefined {
        const index = playerClauses.findIndex(i => i.id === item.id);
        if (index !== -1) {
            playerClauses[index] = {...playerClauses[index], ...item};
        }
        return playerClauses[index];
    }

    public delete(item: { id: string; }): PlayerClause | undefined {
        const index = playerClauses.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = playerClauses[index];
            playerClauses.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
