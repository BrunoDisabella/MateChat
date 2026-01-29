import fs from 'fs';

/**
 * A simple in-memory store implementation for Baileys
 * Handles contacts, chats, and messages persistence.
 * Replaces the removed makeInMemoryStore from Baileys v7+
 */
export function makeInMemoryStore({ logger }) {
    const chats = {};
    const contacts = {};
    const messages = {};

    const toJSON = () => ({ chats, contacts, messages });

    const fromJSON = (json) => {
        if (json.chats) Object.assign(chats, json.chats);
        if (json.contacts) Object.assign(contacts, json.contacts);
        // Messages are usually not stored/loaded deep in simple implementations or might be too large
        // But for completeness we can load them if present
        if (json.messages) Object.assign(messages, json.messages);
    };

    const writeToFile = (path) => {
        try {
            fs.writeFileSync(path, JSON.stringify(toJSON(), null, 2));
        } catch (error) {
            if (logger) logger.error({ error }, 'failed to save store');
        }
    };

    const readFromFile = (path) => {
        try {
            if (fs.existsSync(path)) {
                const data = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }));
                fromJSON(data);
            }
        } catch (error) {
            if (logger) logger.error({ error }, 'failed to read store');
        }
    };

    const bind = (ev) => {
        ev.on('contacts.upsert', (newContacts) => {
            for (const contact of newContacts) {
                if (contacts[contact.id]) {
                    Object.assign(contacts[contact.id], contact);
                } else {
                    contacts[contact.id] = contact;
                }
            }
        });

        ev.on('contacts.update', (updates) => {
            for (const update of updates) {
                if (contacts[update.id]) {
                    Object.assign(contacts[update.id], update);
                }
            }
        });

        ev.on('chats.upsert', (newChats) => {
            for (const chat of newChats) {
                if (chats[chat.id]) {
                    Object.assign(chats[chat.id], chat);
                } else {
                    chats[chat.id] = chat;
                }
            }
        });

        ev.on('chats.update', (updates) => {
            for (const update of updates) {
                if (chats[update.id]) {
                    Object.assign(chats[update.id], update);
                }
            }
        });

        // Message handling is more complex (dictionaries per chat), skipping for now as not required for LID resolution
    };

    return {
        chats,
        contacts,
        messages,
        readFromFile,
        writeToFile,
        bind
    };
}
