import { Repository } from '../../shared/repository.js';
import { PlayerPointsBreakdown } from './playerPointsBreakdown.entity.js';

const playerPointsBreakdowns = [
    new PlayerPointsBreakdown(
    "sample",
    "sample",
    "sample",
    0,
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class PlayerPointsBreakdownRepository implements Repository<PlayerPointsBreakdown> {

    public findAll(): PlayerPointsBreakdown[] | undefined {
        return playerPointsBreakdowns;
    }

    public findOne(item: { id: string; }): PlayerPointsBreakdown | undefined {
        return playerPointsBreakdowns.find(i => i.id === item.id);
    }

    public add(item: PlayerPointsBreakdown): PlayerPointsBreakdown | undefined {
        playerPointsBreakdowns.push(item);
        return item;
    }

    public update(item: PlayerPointsBreakdown): PlayerPointsBreakdown | undefined {
        const index = playerPointsBreakdowns.findIndex(i => i.id === item.id);
        if (index !== -1) {
            playerPointsBreakdowns[index] = {...playerPointsBreakdowns[index], ...item};
        }
        return playerPointsBreakdowns[index];
    }

    public delete(item: { id: string; }): PlayerPointsBreakdown | undefined {
        const index = playerPointsBreakdowns.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = playerPointsBreakdowns[index];
            playerPointsBreakdowns.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
