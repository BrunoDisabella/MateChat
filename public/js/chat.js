document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const contactsList = document.getElementById('contacts-list');
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const connectionStatus = document.getElementById('connection-status');
    const chatInputContainer = document.getElementById('chat-input-container');
    
    let currentContact = null;
    let contacts = {};
    
    // Handle WhatsApp connection status
    socket.on('whatsappStatus', (data) => {
        if (data.status === 'connected') {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'connected';
        } else {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.className = 'disconnected';
        }
    });
    
    // Check initial WhatsApp status
    fetch('/api/whatsapp-status')
        .then(response => response.json())
        .then(data => {
            if (data.isConnected) {
                connectionStatus.textContent = 'Connected';
                connectionStatus.className = 'connected';
            } else {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.className = 'disconnected';
            }
        })
        .catch(error => console.error('Error fetching WhatsApp status:', error));
    
    // Load messages
    fetch('/api/messages')
        .then(response => response.json())
        .then(messages => {
            // Process messages and build contacts list
            messages.forEach(message => {
                const phoneNumber = message.phoneNumber;
                
                if (!contacts[phoneNumber]) {
                    contacts[phoneNumber] = {
                        lastMessage: message,
                        messages: [message]
                    };
                } else {
                    contacts[phoneNumber].messages.push(message);
                    
                    // Update last message if this is newer
                    if (new Date(message.timestamp) > new Date(contacts[phoneNumber].lastMessage.timestamp)) {
                        contacts[phoneNumber].lastMessage = message;
                    }
                }
            });
            
            // Update contacts list
            updateContactsList();
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            contactsList.innerHTML = '<li class="error">Error loading contacts</li>';
        });
    
    // Handle new incoming messages
    socket.on('newMessage', (message) => {
        const phoneNumber = message.phoneNumber;
        
        // Update contacts object
        if (!contacts[phoneNumber]) {
            contacts[phoneNumber] = {
                lastMessage: message,
                messages: [message]
            };
        } else {
            contacts[phoneNumber].messages.push(message);
            contacts[phoneNumber].lastMessage = message;
        }
        
        // Update UI
        updateContactsList();
        
        // If this is from the current contact, add it to the chat
        if (currentContact === phoneNumber) {
            addMessageToChat(message);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
    
    // Handle message form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!currentContact) return;
        
        const content = messageInput.value.trim();
        if (!content) return;
        
        // Clear input
        messageInput.value = '';
        
        // Send message
        fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: currentContact,
                content: content
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            return response.json();
        })
        .then(data => {
            console.log('Message sent:', data);
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        });
    });
    
    // Update the contacts list in the UI
    function updateContactsList() {
        // Sort contacts by most recent message
        const sortedContacts = Object.entries(contacts)
            .sort((a, b) => {
                return new Date(b[1].lastMessage.timestamp) - new Date(a[1].lastMessage.timestamp);
            });
        
        if (sortedContacts.length === 0) {
            contactsList.innerHTML = '<li class="no-contacts">No contacts yet</li>';
            return;
        }
        
        contactsList.innerHTML = '';
        
        sortedContacts.forEach(([phoneNumber, contactData]) => {
            const li = document.createElement('li');
            li.dataset.phoneNumber = phoneNumber;
            
            // Format phone number for display
            const formattedPhone = formatPhoneNumber(phoneNumber);
            
            // Get preview of last message
            const lastMessage = contactData.lastMessage.content;
            const preview = lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage;
            
            // Set active class if this is the current contact
            if (phoneNumber === currentContact) {
                li.classList.add('active');
            }
            
            li.innerHTML = `
                <div class="contact-name">${formattedPhone}</div>
                <div class="contact-preview">${preview}</div>
            `;
            
            li.addEventListener('click', () => selectContact(phoneNumber));
            
            contactsList.appendChild(li);
        });
    }
    
    // Select a contact to view their messages
    function selectContact(phoneNumber) {
        // Update current contact
        currentContact = phoneNumber;
        
        // Update UI
        updateContactsList();
        displayMessages(phoneNumber);
        
        // Show chat input
        chatInputContainer.style.display = 'block';
    }
    
    // Display messages for a contact
    function displayMessages(phoneNumber) {
        if (!contacts[phoneNumber]) {
            messagesContainer.innerHTML = '<p class="no-messages">No messages found</p>';
            return;
        }
        
        // Sort messages by timestamp (oldest first)
        const messages = [...contacts[phoneNumber].messages]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            addMessageToChat(message);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Add a message to the chat
    function addMessageToChat(message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        // Determine if this is an incoming or outgoing message
        const isIncoming = message.responseStatus === 'Pending';
        messageDiv.classList.add(isIncoming ? 'message-incoming' : 'message-outgoing');
        
        // Format the timestamp
        const timestamp = new Date(message.timestamp);
        const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = timestamp.toLocaleDateString();
        
        messageDiv.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${formattedTime} | ${formattedDate}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    }
    
    // Format phone number for display
    function formatPhoneNumber(phoneNumber) {
        // Remove the @c.us suffix if present
        let formatted = phoneNumber.replace('@c.us', '');
        
        // Add spacing for readability if it's a long number
        if (formatted.length > 10) {
            // Format as international number with spaces
            // This is just a simple example, you might want to use a library for proper formatting
            const countryCode = formatted.substring(0, formatted.length - 10);
            const number = formatted.substring(formatted.length - 10);
            
            formatted = '+' + countryCode + ' ' + number.substring(0, 3) + ' ' + number.substring(3, 6) + ' ' + number.substring(6);
        }
        
        return formatted;
    }
});