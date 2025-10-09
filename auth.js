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
// Declare social providers
let googleProvider;
let githubProvider;

// Get DOM elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submit-button');
const formTitle = document.getElementById('form-title');
const toggleLink = document.getElementById('toggle-auth');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
// NEW: Get the Google and GitHub Sign-In button elements
const googleSignInButton = document.getElementById('google-signin-button');
const githubSignInButton = document.getElementById('github-signin-button');


let isLoginMode = true; 
const DASHBOARD_URL = 'dashboard.html'; // The page to redirect to


/**
 * FIX: This function initializes Firebase and sets up listeners ONLY after 
 * the 'firebase' object is guaranteed to exist.
 */
function initializeAuthAndListeners() {
    
    // Safety check (should always pass if SDKs are loaded)
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.warn("Firebase SDK not yet loaded in auth.js. Retrying initialization in 100ms...");
        setTimeout(initializeAuthAndListeners, 100);
        return;
    }

    try {
        // Initialize Firebase
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        // Initialize Auth Providers
        googleProvider = new firebase.auth.GoogleAuthProvider();
        githubProvider = new firebase.auth.GithubAuthProvider();
        
        console.log("Firebase Auth initialized successfully.");
        
        // Setup the Auth state change listener (which redirects on success)
        auth.onAuthStateChanged(user => {
            if (user) {
                window.location.replace(DASHBOARD_URL);
            }
        });
        
    } catch(error) {
         console.error("Critical Error: Firebase Auth initialization failed.", error);
         errorMessage.textContent = 'Critical Error: Firebase failed to initialize. Check console.';
         return; 
    }

    
    // Attach all event listeners now that 'auth' is defined
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateUI();
    });

    authForm.addEventListener('submit', handleFormSubmission);
    
    // Add listeners for social sign-in buttons
    if (googleSignInButton) {
        googleSignInButton.addEventListener('click', handleGoogleSignIn);
    }
    if (githubSignInButton) {
        githubSignInButton.addEventListener('click', handleGithubSignIn);
    }
    
    updateUI();
}


/**
 * Updates the UI to switch between Login and Sign Up modes.
 */
function updateUI() {
    errorMessage.textContent = ''; 
    successMessage.style.display = 'none'; 

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
    // Show social buttons if they exist in the HTML
    if (googleSignInButton) googleSignInButton.style.display = 'block';
    if (githubSignInButton) githubSignInButton.style.display = 'block';
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
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await auth.signInWithEmailAndPassword(email, password);
            
            submitButton.textContent = 'Logged In... Redirecting!'; 

        } catch (error) {
            console.error('Login Error:', error);
            // Use innerHTML for the error message to display the contact support link
            errorMessage.innerHTML = 'Login failed: ' + formatFirebaseError(error.code);
            submitButton.textContent = 'Log In'; 
        }
    } else {
        // --- SIGN UP LOGIC ---
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            
            successMessage.innerHTML = `Account created! Redirecting to dashboard...`;
            successMessage.style.display = 'block';
            authForm.reset();
            
        } catch (error) {
            console.error('Sign Up Error:', error);
            errorMessage.textContent = 'Sign up failed: ' + formatFirebaseError(error.code);
        }
    }
}


/**
 * Handles Sign In with Google via a popup.
 */
async function handleGoogleSignIn() {
    errorMessage.textContent = '';
    successMessage.style.display = 'none';
    googleSignInButton.textContent = 'Waiting for Google...';

    try {
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            console.error('Google Sign-In Error:', error);
            errorMessage.textContent = 'Google sign-in failed. Please try again.';
        }
        googleSignInButton.textContent = 'Sign in with Google'; 
    }
}


/**
 * Handles Sign In with GitHub via a popup.
 */
async function handleGithubSignIn() {
    errorMessage.textContent = '';
    successMessage.style.display = 'none';
    githubSignInButton.textContent = 'Waiting for GitHub...';

    try {
        await auth.signInWithPopup(githubProvider);
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            console.error('GitHub Sign-In Error:', error);
            errorMessage.textContent = 'GitHub sign-in failed. Please try again.';
        }
        githubSignInButton.textContent = 'Sign in with GitHub'; 
    }
}


/**
 * Helper function to format Firebase error codes into readable messages.
 * @param {string} code - The Firebase error code.
 * @returns {string} - A user-friendly error message (can include HTML for the link).
 */
function formatFirebaseError(code) {
    switch (code) {
        case 'auth/user-disabled':
            // Specific message for disabled accounts with the recovery link
            return `This account was disabled. To recover, please <a href="https://docs.google.com/forms/d/e/1FAIpQLSfCIyPXOPKTrPczbSOHovRtMcHZZoUt_EE6kuNSfYdAYNgcGA/viewform?usp=send_form" target="_blank">contact support</a>.`;
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
