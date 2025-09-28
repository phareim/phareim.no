import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { useRuntimeConfig } from '#imports'

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
    const config = useRuntimeConfig()
    
    // Debug log to check environment variables
    console.log('Firebase Config:', {
        projectId: config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        privateKeyExists: !!config.firebasePrivateKey
    });

    if (!config.firebasePrivateKey) {
        throw new Error('Firebase private key is missing from environment variables');
    }

    // Handle both formats of private key
    const privateKey = config.firebasePrivateKey.includes('\\n') 
        ? config.firebasePrivateKey.replace(/\\n/g, '\n')
        : config.firebasePrivateKey;

    try {
        initializeApp({
            credential: cert({
                projectId: config.firebaseProjectId,
                clientEmail: config.firebaseClientEmail,
                privateKey: privateKey
            })
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

export const db = getFirestore()
export const storage = getStorage()
export const placesCollection = 'places' 