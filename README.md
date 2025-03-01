# MateChat - WhatsApp Integration

MateChat is a web application that connects to WhatsApp Web via QR code scanning, captures messages in real-time, stores them in MongoDB, and allows automated responses through N8N integration.

## Features

- WhatsApp Web connection via QR code scanning
- Real-time message capture and storage
- WebSocket communication for live updates
- MongoDB integration for message storage
- N8N webhook integration for chatbot automation
- Easy deployment to Railway

## Prerequisites

- Node.js 16 or higher
- MongoDB Atlas account or local MongoDB installation
- N8N instance for chatbot automation
- Railway account for deployment (optional)

## Local Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/matechat.git
   cd matechat
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   N8N_WEBHOOK_URL=your_n8n_webhook_url
   ```

4. Start the application:
   ```
   npm start
   ```

5. Access the application:
   Open your browser and navigate to `http://localhost:3000`

## Connecting WhatsApp

1. Open the MateChat application in your browser
2. Scan the QR code with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings/Menu > WhatsApp Web
   - Scan the QR code displayed on the screen
3. Once connected, you can start receiving messages in the chat interface

## N8N Integration

1. Set up a new workflow in N8N
2. Add a webhook node as the trigger:
   - Method: POST
   - Path: `/whatsapp`
   - Save the webhook URL

3. Add your automation logic in N8N:
   - Process incoming messages
   - Generate responses based on message content
   - Send responses back to MateChat

4. Add an HTTP Request node to send responses:
   - Method: POST
   - URL: `http://your-matechat-url/api/send-message`
   - Body:
     ```json
     {
       "phoneNumber": "{{$node[\"Webhook\"].json[\"phoneNumber\"]}}",
       "content": "Your automated response here"
     }
     ```

5. Update your `.env` file with the N8N webhook URL:
   ```
   N8N_WEBHOOK_URL=your_n8n_webhook_url
   ```

## Deployment to Railway

1. Create a new Railway project
2. Connect your GitHub repository
3. Set the environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `N8N_WEBHOOK_URL`: Your N8N webhook URL
4. Deploy the application

Railway will automatically build and deploy your application using the Dockerfile.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────┐
│  WhatsApp   │◄────►│   MateChat   │◄────►│  MongoDB  │
│   Mobile    │      │    Server    │      │           │
└─────────────┘      └──────┬───────┘      └───────────┘
                            │
                            │
                            ▼
                     ┌──────────────┐
                     │     N8N      │
                     │  Automation  │
                     └──────────────┘
```

## Technologies Used

- Node.js and Express for the backend
- whatsapp-web.js for WhatsApp integration
- Socket.IO for real-time communication
- MongoDB for message storage
- EJS for server-side rendering
- Docker for containerization
- Railway for deployment

## License

This project is licensed under the MIT License.