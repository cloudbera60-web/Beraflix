const { ytmp3, tiktok, facebook, instagram, twitter, ytmp4 } = require('sadaslk-dlcore');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const FileType = require('file-type');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');

if (fs.existsSync('2nd_dev_config.env')) require('dotenv').config({ path: './2nd_dev_config.env' });

const { sms } = require("./msg");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    downloadContentFromMessage,
    getContentType,
    generateWAMessageFromContent,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    getAggregateVotesInPollMessage
} = require('@whiskeysockets/baileys');

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ellyongiro8:QwXDXE6tyrGpUTNb@cluster0.tyxcmm9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// PayHero API Configuration
const PAYHERO_AUTH_TOKEN = process.env.AUTH_TOKEN; // Use: AUTH_TOKEN=Basic xxxxxxxxxxxxx

process.env.NODE_ENV = 'production';
process.env.PM2_NAME = 'breshyb';

console.log('🚀 Auto Session Manager initialized with MongoDB Atlas');

const config = {
    // General Bot Settings
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['💗', '🩵', '🥺', '🫶', '😶'],

    // Newsletter Auto-React Settings
    AUTO_REACT_NEWSLETTERS: 'true',
    NEWSLETTER_JIDS: ['120363299029326322@newsletter','120363401297349965@newsletter','120363339980514201@newsletter','120363420947784745@newsletter','120363296314610373@newsletter'],
    NEWSLETTER_REACT_EMOJIS: ['🐥', '🤭', '♥️', '🙂', '☺️', '🩵', '🫶'],
    
    // OPTIMIZED Auto Session Management for Heroku Dynos
    AUTO_SAVE_INTERVAL: 300000,
    AUTO_CLEANUP_INTERVAL: 900000,
    AUTO_RECONNECT_INTERVAL: 300000,
    AUTO_RESTORE_INTERVAL: 1800000,
    MONGODB_SYNC_INTERVAL: 600000,
    MAX_SESSION_AGE: 604800000,
    DISCONNECTED_CLEANUP_TIME: 300000,
    MAX_FAILED_ATTEMPTS: 3,
    INITIAL_RESTORE_DELAY: 10000,
    IMMEDIATE_DELETE_DELAY: 60000,

    // Command Settings
    PREFIX: '.',
    MAX_RETRIES: 3,

    // Group & Channel Settings
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/JXaWiMrpjWyJ6Kd2G9FAAq?mode=ems_copy_t',
    NEWSLETTER_JID: '120363299029326322@newsletter',
    NEWSLETTER_MESSAGE_ID: '291',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb6V5Xl6LwHgkapiAI0V',

    // File Paths
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://i.ibb.co/zhm2RF8j/vision-v.jpg',
    NUMBER_LIST_PATH: './numbers.json',
    SESSION_STATUS_PATH: './session_status.json',
    SESSION_BASE_PATH: './session',

    // Security & OTP
    OTP_EXPIRY: 300000,

    // News Feed
    NEWS_JSON_URL: 'https://raw.githubusercontent.com/boychalana9-max/mage/refs/heads/main/main.json?token=GHSAT0AAAAAADJU6UDFFZ67CUOLUQAAWL322F3RI2Q',

    // Owner Details
    OWNER_NUMBER: '254740007567',
    TRANSFER_OWNER_NUMBER: '254740007567',
};

// Session Management Maps
const activeSockets = new Map();
const socketCreationTime = new Map();
const disconnectionTime = new Map();
const sessionHealth = new Map();
const reconnectionAttempts = new Map();
const lastBackupTime = new Map();
const otpStore = new Map();
const pendingSaves = new Map();
const restoringNumbers = new Set();
const sessionConnectionStatus = new Map();
const stores = new Map();
const followedNewsletters = new Map();

// Payment tracking for STK Push
const pendingPayments = new Map();

// Auto-management intervals
let autoSaveInterval;
let autoCleanupInterval;
let autoReconnectInterval;
let autoRestoreInterval;
let mongoSyncInterval;

// MongoDB Connection
let mongoConnected = false;

// MongoDB Schemas
const sessionSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    sessionData: { type: Object, required: true },
    status: { type: String, default: 'active', index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    health: { type: String, default: 'active' }
});

const userConfigSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true, index: true },
    config: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true, index: true },
    sender: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'pending', index: true },
    checkoutRequestId: { type: String },
    merchantRequestId: { type: String },
    mpesaReceiptNumber: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', sessionSchema);
const UserConfig = mongoose.model('UserConfig', userConfigSchema);
const Payment = mongoose.model('Payment', paymentSchema);

// Initialize MongoDB Connection
async function initializeMongoDB() {
    try {
        if (mongoConnected) return true;

        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5
        });

        mongoConnected = true;
        console.log('✅ MongoDB Atlas connected successfully');

        await Session.createIndexes().catch(err => console.error('Index creation error:', err));
        await UserConfig.createIndexes().catch(err => console.error('Index creation error:', err));
        await Payment.createIndexes().catch(err => console.error('Index creation error:', err));

        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        mongoConnected = false;

        setTimeout(() => {
            initializeMongoDB();
        }, 5000);

        return false;
    }
}

// MongoDB Session Management Functions
async function saveSessionToMongoDB(number, sessionData) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');

        if (!isSessionActive(sanitizedNumber)) {
            console.log(`⏭️ Not saving inactive session to MongoDB: ${sanitizedNumber}`);
            return false;
        }

        if (!validateSessionData(sessionData)) {
            console.warn(`⚠️ Invalid session data, not saving to MongoDB: ${sanitizedNumber}`);
            return false;
        }

        await Session.findOneAndUpdate(
            { number: sanitizedNumber },
            {
                sessionData: sessionData,
                status: 'active',
                updatedAt: new Date(),
                lastActive: new Date(),
                health: sessionHealth.get(sanitizedNumber) || 'active'
            },
            { upsert: true, new: true }
        );

        console.log(`✅ Session saved to MongoDB: ${sanitizedNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ MongoDB save failed for ${number}:`, error.message);
        pendingSaves.set(number, {
            data: sessionData,
            timestamp: Date.now()
        });
        return false;
    }
}

async function loadSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');

        const session = await Session.findOne({ 
            number: sanitizedNumber,
            status: { $ne: 'deleted' }
        });

        if (session) {
            console.log(`✅ Session loaded from MongoDB: ${sanitizedNumber}`);
            return session.sessionData;
        }

        return null;
    } catch (error) {
        console.error(`❌ MongoDB load failed for ${number}:`, error.message);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');

        await Session.deleteOne({ number: sanitizedNumber });
        await UserConfig.deleteOne({ number: sanitizedNumber });

        console.log(`🗑️ Session deleted from MongoDB: ${sanitizedNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ MongoDB delete failed for ${number}:`, error.message);
        return false;
    }
}

// PAYMENT MANAGEMENT FUNCTIONS
async function savePaymentToMongoDB(paymentData) {
    try {
        const payment = new Payment(paymentData);
        await payment.save();
        console.log(`✅ Payment saved to MongoDB: ${paymentData.paymentId}`);
        return payment;
    } catch (error) {
        console.error(`❌ Failed to save payment to MongoDB:`, error.message);
        return null;
    }
}

async function updatePaymentStatus(paymentId, status, updateData = {}) {
    try {
        const update = {
            status: status,
            updatedAt: new Date(),
            ...updateData
        };

        const payment = await Payment.findOneAndUpdate(
            { paymentId: paymentId },
            update,
            { new: true }
        );

        if (payment) {
            console.log(`✅ Payment ${paymentId} updated to status: ${status}`);
            return payment;
        }
        return null;
    } catch (error) {
        console.error(`❌ Failed to update payment status:`, error.message);
        return null;
    }
}

async function getPaymentByCheckoutId(checkoutRequestId) {
    try {
        const payment = await Payment.findOne({ checkoutRequestId: checkoutRequestId });
        return payment;
    } catch (error) {
        console.error(`❌ Failed to get payment by checkout ID:`, error.message);
        return null;
    }
}

// STK PUSH HELPER FUNCTION
async function initiateSTKPush(phone, amount) {
    try {
        // Format phone number (07XXXXXXXX → 2547XXXXXXXX)
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+254')) {
            formattedPhone = '254' + formattedPhone.substring(4);
        } else if (formattedPhone.length === 9) {
            formattedPhone = '254' + formattedPhone;
        }
        
        // Validate phone number format
        if (!formattedPhone.startsWith('2547') || formattedPhone.length !== 12) {
            throw new Error('Invalid phone number format. Use format: 07XXXXXXXX or 2547XXXXXXXX');
        }

        // Validate amount
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error('Invalid amount. Please provide a valid number greater than 0');
        }

        if (amountNum < 1 || amountNum > 70000) {
            throw new Error('Amount must be between KES 1 and KES 70,000');
        }

        // Check if AUTH_TOKEN is configured
        if (!PAYHERO_AUTH_TOKEN) {
            throw new Error('PayHero AUTH_TOKEN not configured. Add AUTH_TOKEN=Basic xxxxxxxxxxxxx to your .env file');
        }

        // Prepare request data for PayHero API
        const requestData = {
            amount: amountNum,
            phone: formattedPhone,
            account_number: "Mercedes Bot",
            description: "Service Payment via WhatsApp Bot"
        };

        console.log(`📤 Sending STK Push to PayHero API:`, {
            phone: formattedPhone,
            amount: amountNum,
            timestamp: new Date().toISOString()
        });

        // Make API call to PayHero
        const response = await axios.post(
            'https://api.payhero.co.ke/api/v2/stkpush',
            requestData,
            {
                headers: {
                    'Authorization': PAYHERO_AUTH_TOKEN,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mercedes-Mini-Bot/1.0'
                },
                timeout: 30000 // 30 seconds timeout
            }
        );

        console.log(`📥 PayHero API Response:`, response.data);

        // Handle response
        if (response.data && (response.data.success === true || response.data.ResponseCode === '0')) {
            return {
                success: true,
                message: 'STK Push initiated successfully',
                data: response.data,
                formattedPhone: formattedPhone,
                amount: amountNum,
                checkoutRequestId: response.data.CheckoutRequestID || response.data.checkoutRequestID,
                merchantRequestId: response.data.MerchantRequestID || response.data.merchantRequestID
            };
        } else {
            throw new Error(response.data.message || response.data.ResponseDescription || 'Unknown API error');
        }

    } catch (error) {
        console.error('❌ STK Push Error:', error);
        
        let errorMessage = 'Failed to initiate STK Push';
        
        if (error.response) {
            // Axios error with response
            const status = error.response.status;
            const data = error.response.data;
            
            errorMessage = `API Error (${status}): `;
            
            if (data.message) {
                errorMessage += data.message;
            } else if (data.errorMessage) {
                errorMessage += data.errorMessage;
            } else if (data.ResponseDescription) {
                errorMessage += data.ResponseDescription;
            }
            
            if (status === 401) {
                errorMessage += ' - Invalid AUTH_TOKEN. Check your .env file';
            } else if (status === 400) {
                errorMessage += ' - Invalid request parameters';
            }
        } else if (error.request) {
            errorMessage = 'Network error: No response from PayHero API';
        } else {
            errorMessage = error.message || 'Unknown error occurred';
        }
        
        throw new Error(errorMessage);
    }
}

// Rest of your existing functions (handleBadMacError, downloadAndSaveMedia, isOwner, etc.)
// ... [ALL YOUR EXISTING FUNCTIONS REMAIN THE SAME] ...

// In the setupCommandHandlers function, add the new cases:

function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        // Skip if no message or it's a status message or newsletter
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
        
        // Skip if it's a newsletter message
        const isNewsletter = config.NEWSLETTER_JIDS.some(jid =>
            msg.key.remoteJid === jid || msg.key.remoteJid?.includes(jid)
        );
        if (isNewsletter) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        // Extract command and arguments
        if (msg.message.conversation) {
            const text = msg.message.conversation.trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        } else if (msg.message.extendedTextMessage?.text) {
            const text = msg.message.extendedTextMessage.text.trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        // Handle button responses
        if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        // Handle list responses
        if (msg.message.listResponseMessage) {
            const listId = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
            if (listId && listId.startsWith(config.PREFIX)) {
                const parts = listId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        console.log(`📥 Command received: ${command} from ${sender}`);

        try {
            switch (command) {
                // ... [ALL YOUR EXISTING COMMAND CASES REMAIN THE SAME] ...
                
                // NEW STK/PUSH COMMANDS ADDED HERE
                case 'stk':
                case 'pay': {
                    try {
                        // Check if user is authorized
                        if (!isOwner(s
