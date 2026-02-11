import { Repository } from '../../shared/repository.js';
import { PlayerPerformance } from './playerPerformance.entity.js';

const playerPerformances = [
    new PlayerPerformance(
    "sample",
    "sample",
    0,
    true,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class PlayerPerformanceRepository implements Repository<PlayerPerformance> {

    public findAll(): PlayerPerformance[] | undefined {
        return playerPerformances;
    }

    public findOne(item: { id: string; }): PlayerPerformance | undefined {
        return playerPerformances.find(i => i.id === item.id);
    }

    public add(item: PlayerPerformance): PlayerPerformance | undefined {
        playerPerformances.push(item);
        return item;
    }

    public update(item: PlayerPerformance): PlayerPerformance | undefined {
        const index = playerPerformances.findIndex(i => i.id === item.id);
        if (index !== -1) {
            playerPerformances[index] = {...playerPerformances[index], ...item};
        }
        return playerPerformances[index];
    }

    public delete(item: { id: string; }): PlayerPerformance | undefined {
        const index = playerPerformances.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = playerPerformances[index];
            playerPerformances.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
