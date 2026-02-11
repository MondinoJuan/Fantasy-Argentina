import { Repository } from '../../shared/repository.js';
import { ParticipantSquad } from './participantSquad.entity.js';

const participantSquads = [
    new ParticipantSquad(
    "sample",
    "sample",
    new Date("2024-01-01T00:00:00.000Z"),
    new Date("2024-01-01T00:00:00.000Z"),
    0,
    "sample",
    '550e8400-e29b-41d4-a716-446655440000'
    )
];

export class ParticipantSquadRepository implements Repository<ParticipantSquad> {

    public findAll(): ParticipantSquad[] | undefined {
        return participantSquads;
    }

    public findOne(item: { id: string; }): ParticipantSquad | undefined {
        return participantSquads.find(i => i.id === item.id);
    }

    public add(item: ParticipantSquad): ParticipantSquad | undefined {
        participantSquads.push(item);
        return item;
    }

    public update(item: ParticipantSquad): ParticipantSquad | undefined {
        const index = participantSquads.findIndex(i => i.id === item.id);
        if (index !== -1) {
            participantSquads[index] = {...participantSquads[index], ...item};
        }
        return participantSquads[index];
    }

    public delete(item: { id: string; }): ParticipantSquad | undefined {
        const index = participantSquads.findIndex(i => i.id === item.id);
        if (index !== -1) {
            const deletedItem = participantSquads[index];
            participantSquads.splice(index, 1);
            return deletedItem;
        }
        return undefined;
    }
}
