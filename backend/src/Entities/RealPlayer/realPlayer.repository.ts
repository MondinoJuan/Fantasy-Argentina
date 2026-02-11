import { Repository } from '../../shared/repository.js';
import { RealPlayer } from './realPlayer.entity.js';

const realPlayers = [
    new RealPlayer(
    "sample",
    "sample",
    "sample",
    "sample",
    0,
    true,
    new Date("2024-01-01T00:00:00.000Z"),
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class RealPlayerRepository implements Repository<RealPlayer> {

    public findAll(): RealPlayer[] | undefined {
        return realPlayers;
    }

    public findOne(item: { id: string; }): RealPlayer | undefined {
        return realPlayers.find(i => i.id === item.id);
    }

    public add(item: RealPlayer): RealPlayer | undefined {
        realPlayers.push(item);
        return item;
    }

    public update(item: RealPlayer): RealPlayer | undefined {
        const index = realPlayers.findIndex(i => i.id === item.id);
        if (index !== -1) {
            realPlayers[index] = {...realPlayers[index], ...item};
        }
        return realPlayers[index];
    }

    public delete(item: { id: string; }): RealPlayer | undefined {
        const index = realPlayers.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = realPlayers[index];
            realPlayers.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
