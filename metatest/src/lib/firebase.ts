// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
    apiKey: "AIzaSyCzDugvcIjeYxxpYBW_cYglUMtJKGJe9o8",
    authDomain: "tam24chat.firebaseapp.com",
    projectId: "tam24chat",
    storageBucket: "tam24chat.firebasestorage.app",
    messagingSenderId: "655956403730",
    appId: "1:655956403730:web:1580513e134da640ffdacb",
    measurementId: "G-1VECT8VJW7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
