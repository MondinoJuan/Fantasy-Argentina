import express, {Request, Response, NextFunction} from 'express';
import { User } from './Entities/User/user.js';

const app = express();
app.use(express.json());

const users = [
    new User(
        'user1', 
        'pass1', 
        'user1@gmail.com',
        '550e8400-e29b-41d4-a716-446655440000' 
    )
];

function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizeUserInput = {
        username: String(req.body.username || '').trim(),
        password: String(req.body.password || '').trim(),
        mail: String(req.body.mail || '').trim()
    };
    // more checks
    // ----------------------------------------------------------------------------------------------------------------------------------------
    const errors: string[] = [];

    const isCreate = req.method === 'POST';
    const isPut = req.method === 'PUT';
    const isPatch = req.method === 'PATCH';

    // Detectar si el campo fue enviado realmente (porque si no, te queda '' igual)
    const sentUsername = Object.prototype.hasOwnProperty.call(req.body, 'username');
    const sentPassword = Object.prototype.hasOwnProperty.call(req.body, 'password');
    const sentMail = Object.prototype.hasOwnProperty.call(req.body, 'mail');

    // Helpers
    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Normalización extra
    req.body.sanitizeUserInput.mail = req.body.sanitizeUserInput.mail.toLowerCase();

    // Reglas: POST requiere todo
    if (isCreate) {
        if (!req.body.sanitizeUserInput.username) errors.push('username is required');
        if (!req.body.sanitizeUserInput.password) errors.push('password is required');
        if (!req.body.sanitizeUserInput.mail) errors.push('mail is required');
    }

    // PUT suele ser "reemplazo total": también exigir todo
    if (isPut) {
        if (!req.body.sanitizeUserInput.username) errors.push('username is required');
        if (!req.body.sanitizeUserInput.password) errors.push('password is required');
        if (!req.body.sanitizeUserInput.mail) errors.push('mail is required');
    }

    // PATCH permite parcial: pero si mandaste el campo, no puede ser vacío
    if (isPatch) {
        if (sentUsername && !req.body.sanitizeUserInput.username) errors.push('username cannot be empty');
        if (sentPassword && !req.body.sanitizeUserInput.password) errors.push('password cannot be empty');
        if (sentMail && !req.body.sanitizeUserInput.mail) errors.push('mail cannot be empty');

        // Si no mandó ninguno de los 3, no tiene sentido el PATCH
        if (!sentUsername && !sentPassword && !sentMail) {
            errors.push('at least one of username, password, mail must be provided');
        }
    }

    // Validaciones de formato / longitud (solo si el campo está presente o es create/put)
    const u = req.body.sanitizeUserInput.username;
    if ((isCreate || isPut || sentUsername) && u) {
        if (u.length < 3 || u.length > 20) errors.push('username must be 3-20 characters');
        if (!usernameRegex.test(u)) errors.push('username can contain only letters, numbers, "_" and "."');
    }

    const p = req.body.sanitizeUserInput.password;
    if ((isCreate || isPut || sentPassword) && p) {
        if (p.length < 8) errors.push('password must be at least 8 characters');
        // opcional: un mínimo de complejidad (dejalo comentado si querés)
        // if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) errors.push('password must include an uppercase letter and a number');
    }

    const m = req.body.sanitizeUserInput.mail;
    if ((isCreate || isPut || sentMail) && m) {
        if (!emailRegex.test(m)) errors.push('mail must be a valid email');
    }

    // Rechazar campos extra (whitelist)
    const allowed = new Set(['username', 'password', 'mail']);
    const extras = Object.keys(req.body).filter(k => !allowed.has(k) && k !== 'sanitizeUserInput');
    if (extras.length) {
        errors.push(`unknown fields: ${extras.join(', ')}`);
    }

    if (errors.length) {
        return res.status(400).json({ errors });
    }
    // ----------------------------------------------------------------------------------------------------------------------------------------    

    Object.keys(req.body.sanitizeUserInput).forEach(key => {
        if (req.body.sanitizeUserInput[key] === undefined) {
            delete req.body.sanitizeUserInput[key];
        }
    });
    next();
}

app.get('/api/users', (req, res) => {
    res.json({data: users});
});

app.get('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    }
    return res.json({data: user});
});

app.post('/api/users', sanitizeUserInput, (req, res) => {
    const input = req.body.sanitizeUserInput;
    const newUser = new User(
        input.username, 
        input.password, 
        input.mail);
    users.push(newUser);
    res.status(201).send({message: 'User created', data: newUser});
});

app.put('/api/users/:id', sanitizeUserInput, (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex !== -1) {
        users[userIndex] = {...users[userIndex], ...req.body.sanitizeUserInput};
        res.status(200).json({message: 'User updated', data: users[userIndex]});
    } else {
        res.status(404).send({ error: 'User not found' });
    }
});

app.patch('/api/users/:id', sanitizeUserInput, (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (user) {
        const { username, password, mail } = req.body.sanitizeUserInput;
        if (username) user.username = username;
        if (password) user.password = password;
        if (mail) user.mail = mail;
        res.json(user);
    } else {
        res.status(404).send({ error: 'User not found' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex !== -1) {
        users.splice(userIndex, 1);
        res.status(200).send({message: 'User deleted successfully'});
    } else {
        res.status(404).send({ error: 'User not found' });
    }
});

/*
app.use('/', (req, res) => {
    res.send('<h1> Hello, Fantasy Argentina Backend! </h1>');
});
*/

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});