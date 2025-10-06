// ======================================================================
// ⚠️ IMPORTANT: REPLACE THIS PLACEHOLDER WITH YOUR OWN FIREBASE CONFIG
// ======================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
  authDomain: "contract-center-llc-10.firebaseapp.com",
  projectId: "contract-center-llc-10",
  storageBucket: "contract-center-llc-10.firebasestorage.app",
  messagingSenderId: "323221512767",
  appId: "1:323221512767:web:6421260f875997dbf64e8a",
  measurementId: "G-S2RJ0C6BWH"
};

// Declare app and auth globally, but initialize them later.
let app;
let auth;

// Get DOM elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submit-button');
const formTitle = document.getElementById('form-title');
const toggleLink = document.getElementById('toggle-auth');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

let isLoginMode = true; 
const DASHBOARD_URL = 'dashboard.html'; // The page to redirect to


/**
 * FIX: This function initializes Firebase and sets up listeners ONLY after 
 * the 'firebase' object is guaranteed to exist.
 */
function initializeAuthAndListeners() {
    
    // Safety check (should always pass if SDKs are loaded)
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        // If not ready, wait a bit and try again (recursive timeout)
        console.warn("Firebase SDK not yet loaded in auth.js. Retrying initialization in 100ms...");
        setTimeout(initializeAuthAndListeners, 100);
        return;
    }

    try {
        // Initialize Firebase (This is the line that was causing the original error)
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        console.log("Firebase Auth initialized successfully.");
        
        // Setup the Auth state change listener (which redirects on success)
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in. Redirect to the dashboard.
                window.location.replace(DASHBOARD_URL);
            }
            // If no user, stay on the login page.
        });
        
    } catch(error) {
         console.error("Critical Error: Firebase Auth initialization failed.", error);
         errorMessage.textContent = 'Critical Error: Firebase failed to initialize. Check console.';
         return; // Stop further execution if initialization fails
    }

    
    // Attach all event listeners now that 'auth' is defined
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateUI();
    });

    authForm.addEventListener('submit', handleFormSubmission);
    
    // Initial UI setup (which was at the end of the old file)
    updateUI();
}


/**
 * Updates the UI to switch between Login and Sign Up modes.
 */
function updateUI() {
    errorMessage.textContent = ''; // Clear previous errors
    successMessage.style.display = 'none'; // Clear success message

    if (isLoginMode) {
        formTitle.textContent = 'Login';
        submitButton.textContent = 'Log In';
        toggleLink.textContent = 'Sign Up';
        toggleLink.parentElement.firstChild.nodeValue = "Don't have an account? ";
    } else {
        formTitle.textContent = 'Sign Up';
        submitButton.textContent = 'Create Account';
        toggleLink.textContent = 'Log In';
        toggleLink.parentElement.firstChild.nodeValue = "Already have an account? ";
    }
}


/**
 * Handles the submission of the form (Login or Sign Up).
 */
async function handleFormSubmission(e) {
    e.preventDefault();
    errorMessage.textContent = '';
    successMessage.style.display = 'none';

    const email = emailInput.value;
    const password = passwordInput.value;

    if (isLoginMode) {
        // --- LOGIN LOGIC (With Persistence) ---
        try {
            // Set persistence to LOCAL so the user stays logged in
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await auth.signInWithEmailAndPassword(email, password);
            
            submitButton.textContent = 'Logged In... Redirecting!'; 
            // Redirection is handled by the onAuthStateChanged listener above.

        } catch (error) {
            console.error('Login Error:', error);
            errorMessage.textContent = 'Login failed: ' + formatFirebaseError(error.code);
            submitButton.textContent = 'Log In'; // Reset button text
        }
    } else {
        // --- SIGN UP LOGIC ---
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            
            // Note: Dashboard now handles role creation in Firestore (loadUserRole)
            
            successMessage.innerHTML = `Account created! Redirecting to dashboard...`;
            successMessage.style.display = 'block';
            authForm.reset();
            
            // Redirection is handled by the onAuthStateChanged listener above.
            
        } catch (error) {
            console.error('Sign Up Error:', error);
            errorMessage.textContent = 'Sign up failed: ' + formatFirebaseError(error.code);
        }
    }
}


/**
 * Helper function to format Firebase error codes into readable messages.
 * @param {string} code - The Firebase error code.
 * @returns {string} - A user-friendly error message.
 */
function formatFirebaseError(code) {
    switch (code) {
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Invalid email or password.';
        case 'auth/email-already-in-use':
            return 'This email address is already in use.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/invalid-email':
            return 'The email address is not valid.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign-in is not enabled. Please check your Firebase settings.';
        default:
            return 'An unknown error occurred. Please try again.';
    }
}

// Start the initialization check after the DOM is ready
document.addEventListener('DOMContentLoaded', initializeAuthAndListeners);
