import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export default defineNuxtPlugin(nuxtApp => {
    const config = useRuntimeConfig()
    const app = initializeApp(config.public.firebaseConfig)
    const auth = getAuth(app)
    const firestore = getFirestore(app)

    nuxtApp.provide('firebase', { app, auth, firestore })
}) 