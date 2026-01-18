
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
    auth: {
        userId: 'test-user-id-123'
    },
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ Connected successfully! Socket ID:', socket.id);
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

setTimeout(() => {
    console.log('⏰ Timeout waiting for connection');
    process.exit(1);
}, 5000);
