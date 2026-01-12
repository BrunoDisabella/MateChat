
import express from 'express';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { Server as SocketIo } from 'socket.io';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
console.log('All imports successful');
