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

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Get DOM elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submit-button');
const formTitle = document.getElementById('form-title');
const toggleLink = document.getElementById('toggle-auth');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

let isLoginMode = true; // State tracker for the form

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
 * @param {Event} e - The form submission event.
 */
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = ''; // Clear previous errors
    successMessage.style.display = 'none'; // Clear success message

    const email = emailInput.value;
    const password = passwordInput.value;

    if (isLoginMode) {
        // --- LOGIN LOGIC ---
        try {
            await auth.signInWithEmailAndPassword(email, password);
            successMessage.textContent = `Successfully logged in as ${email}!`;
            successMessage.style.display = 'block';
            authForm.reset();
        } catch (error) {
            console.error('Login Error:', error);
            // Display a user-friendly error message
            errorMessage.textContent = 'Login failed: ' + formatFirebaseError(error.code);
        }
    } else {
        // --- SIGN UP LOGIC ---
        try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // 🚀 NEW STEP: Send the email verification link to the user
    await user.sendEmailVerification(); 
    
    // Optional: Log data to Firestore if you are using a database
    // await db.collection("users").doc(user.uid).set({...}); 
    
    successMessage.innerHTML = `
        Account created! A **verification link** has been sent to **${email}**. 
        Please check your inbox to verify your email address.
    `;
    successMessage.style.display = 'block';
    authForm.reset();
    isLoginMode = true;
    updateUI();

} catch (error) {
            console.error('Sign Up Error:', error);
            // Display a user-friendly error message
            errorMessage.textContent = 'Sign up failed: ' + formatFirebaseError(error.code);
        }
    }
});

/**
 * Toggles between Login and Sign Up modes.
 */
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateUI();
});

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

// Initial UI setup
updateUI();
