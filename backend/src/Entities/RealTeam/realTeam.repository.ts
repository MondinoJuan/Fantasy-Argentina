import { Repository } from '../../shared/repository.js';
import { RealTeam } from './realTeam.entity.js';

const realTeams = [
    new RealTeam(
    "sample",
    "sample",
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class RealTeamRepository implements Repository<RealTeam> {

    public findAll(): RealTeam[] | undefined {
        return realTeams;
    }

    public findOne(item: { id: string; }): RealTeam | undefined {
        return realTeams.find(i => i.id === item.id);
    }

    public add(item: RealTeam): RealTeam | undefined {
        realTeams.push(item);
        return item;
    }

    public update(item: RealTeam): RealTeam | undefined {
        const index = realTeams.findIndex(i => i.id === item.id);
        if (index !== -1) {
            realTeams[index] = {...realTeams[index], ...item};
        }
        return realTeams[index];
    }

    public delete(item: { id: string; }): RealTeam | undefined {
        const index = realTeams.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = realTeams[index];
            realTeams.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
