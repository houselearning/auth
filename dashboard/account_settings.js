// Ensure 'auth' is accessible (it's globally defined by main.js)
// Assuming firebase is initialized and 'auth' is exported/global in main.js
if (typeof auth === 'undefined') {
    console.error("Firebase auth object is not available. Check main.js import.");
}

// --- UI Element Mapping ---
const settingsUI = {
    // General elements
    container: document.querySelector('.settings-container'),
    // Profile Display
    currentPfp: document.getElementById('current-pfp'),
    currentName: document.getElementById('current-name'),
    currentEmail: document.getElementById('current-email'),
    loginProviders: document.getElementById('login-providers'),
    
    // Update Profile Form
    profileForm: document.getElementById('update-profile-form'),
    displayNameInput: document.getElementById('display-name'),
    photoUrlInput: document.getElementById('photo-url'),
    profileMessage: document.getElementById('profile-message'),
    
    // Update Email Form
    emailForm: document.getElementById('update-email-form'),
    newEmailInput: document.getElementById('new-email'),
    reauthSection: document.getElementById('reauth-section'),
    reauthPasswordInput: document.getElementById('reauth-password'),
    emailMessage: document.getElementById('email-message'),
    
    // Password Reset
    resetEmailDisplay: document.getElementById('reset-email-display'),
    sendResetBtn: document.getElementById('send-reset-btn'),
    passwordMessage: document.getElementById('password-message'),
    
    // Account Actions
    deleteAccountBtn: document.getElementById('delete-account-btn'),
    deleteMessage: document.getElementById('delete-message'),
};

// --- Utility Functions ---

/**
 * Displays a message in a specific UI element.
 * @param {HTMLElement} element - The message element (e.g., settingsUI.profileMessage)
 * @param {string} type - 'success' or 'error'
 * @param {string} text - The message text
 */
function showMessage(element, type, text) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';
    // Hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

/**
 * Populates the UI fields with the current user's data.
 * @param {firebase.User} user - The current Firebase User object.
 */
function populateUserData(user) {
    // Set current displayed info
    settingsUI.currentPfp.src = user.photoURL || '../../auth/dashboard/default.png';
    settingsUI.currentName.textContent = user.displayName || 'Anon User';
    settingsUI.currentEmail.textContent = user.email || 'Anonymous/Provider Login';
    
    // Set form input initial values
    settingsUI.displayNameInput.value = user.displayName || '';
    settingsUI.photoUrlInput.value = user.photoURL || '';
    settingsUI.resetEmailDisplay.textContent = user.email || 'N/A';
    settingsUI.newEmailInput.value = user.email || '';
    
    // Display login providers
    const providers = user.providerData.map(p => p.providerId);
    let providerText = providers.join(', ');
    settingsUI.loginProviders.textContent = providerText;
    
    // Show re-auth section only if the user uses email/password
    const requiresPassword = providers.includes('password');
    if (requiresPassword) {
        settingsUI.reauthSection.style.display = 'block';
        settingsUI.reauthPasswordInput.required = true;
        settingsUI.sendResetBtn.disabled = false;
        settingsUI.emailForm.querySelector('button[type="submit"]').disabled = false;
    } else {
        // Disable forms for providers that don't allow in-app email/password changes
        settingsUI.reauthSection.style.display = 'none';
        settingsUI.reauthPasswordInput.required = false;
        
        if (!user.email) {
            settingsUI.emailForm.querySelector('button[type="submit"]').disabled = true;
            settingsUI.sendResetBtn.disabled = true;
            showMessage(settingsUI.emailMessage, 'error', 'Email/Password actions are disabled for your current login method.');
        }
    }
}

/**
 * Handles the profile update (Display Name and Photo URL).
 * @param {Event} e - Form submit event.
 */
async function handleUpdateProfile(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const displayName = settingsUI.displayNameInput.value.trim();
    // Use null for an empty photo URL to rely on the default logic
    const photoURL = settingsUI.photoUrlInput.value.trim() || null; 

    try {
        await user.updateProfile({
            displayName: displayName,
            photoURL: photoURL
        });
        
        // Update UI immediately and show success
        populateUserData(user); 
        showMessage(settingsUI.profileMessage, 'success', 'Profile updated successfully! Refreshing page...');
        
        // Small delay to let the message show, then refresh
        setTimeout(() => {
             window.location.reload(); 
        }, 1500);
        
    } catch (error) {
        console.error("Profile Update Error:", error);
        showMessage(settingsUI.profileMessage, 'error', `Update failed: ${error.message}`);
    }
}

/**
 * Handles the email update process, including re-authentication if necessary.
 * @param {Event} e - Form submit event.
 */
async function handleUpdateEmail(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    
    const newEmail = settingsUI.newEmailInput.value.trim();
    const password = settingsUI.reauthPasswordInput.value.trim();
    const isPasswordUser = user.providerData.some(p => p.providerId === 'password');
    
    if (user.email === newEmail) {
        showMessage(settingsUI.emailMessage, 'error', 'New email must be different from the current email.');
        return;
    }

    try {
        if (isPasswordUser) {
             if (!password) {
                 showMessage(settingsUI.emailMessage, 'error', 'Please enter your current password to re-authenticate.');
                 return;
             }
             // 1. Re-authenticate with current credentials
             const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
             await user.reauthenticateWithCredential(credential);
             settingsUI.reauthPasswordInput.value = ''; // Clear password field on success
        }
        
        // 2. Update Email
        await user.updateEmail(newEmail);
        
        // Update UI and show success
        populateUserData(user); 
        showMessage(settingsUI.emailMessage, 'success', 'Email address updated successfully! You may need to verify the new address.');
        
    } catch (error) {
        console.error("Email Update Error:", error);
        
        if (error.code === 'auth/wrong-password') {
            showMessage(settingsUI.emailMessage, 'error', 'Incorrect password. Please try again.');
        } else if (error.code === 'auth/requires-recent-login') {
             showMessage(settingsUI.emailMessage, 'error', 'Please log out and log back in before attempting this action.');
        } else {
            showMessage(settingsUI.emailMessage, 'error', `Update failed: ${error.message}`);
        }
    }
}

/**
 * Sends a password reset email to the current user's email.
 */
async function handleSendResetEmail() {
    const user = auth.currentUser;
    if (!user || !user.email) {
        showMessage(settingsUI.passwordMessage, 'error', 'Cannot send reset email. User is not logged in with an email/password.');
        return;
    }
    
    settingsUI.sendResetBtn.disabled = true;

    try {
        await auth.sendPasswordResetEmail(user.email);
        showMessage(settingsUI.passwordMessage, 'success', `Password reset email sent to ${user.email}. Check your inbox!`);
    } catch (error) {
        console.error("Password Reset Error:", error);
        showMessage(settingsUI.passwordMessage, 'error', `Failed to send reset email: ${error.message}`);
    } finally {
        setTimeout(() => { settingsUI.sendResetBtn.disabled = false; }, 3000);
    }
}

/**
 * Handles the deletion of the user's account.
 */
async function handleDeleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    
    if (!confirm("⚠️ WARNING: Are you sure you want to permanently delete your HouseLearning account? This action cannot be undone.")) {
        return;
    }
    
    settingsUI.deleteAccountBtn.disabled = true;

    try {
        await user.delete();
        // Redirect to the homepage after successful deletion
        alert("Your account has been successfully deleted.");
        window.location.href = '../../';
    } catch (error) {
        console.error("Account Deletion Error:", error);
        
        if (error.code === 'auth/requires-recent-login') {
            showMessage(settingsUI.deleteMessage, 'error', 'For security, please log out and log back in immediately before attempting to delete your account.');
        } else {
            showMessage(settingsUI.deleteMessage, 'error', `Deletion failed: ${error.message}`);
        }
    } finally {
        setTimeout(() => { settingsUI.deleteAccountBtn.disabled = false; }, 3000);
    }
}

// ====================================================================
// MAIN EXECUTION
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Auth State and initialize the page
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in. Populate all fields and enable forms.
                populateUserData(user);
                
                // Attach event listeners
                settingsUI.profileForm.addEventListener('submit', handleUpdateProfile);
                settingsUI.emailForm.addEventListener('submit', handleUpdateEmail);
                settingsUI.sendResetBtn.addEventListener('click', handleSendResetEmail);
                settingsUI.deleteAccountBtn.addEventListener('click', handleDeleteAccount);
                
            } else {
                // User is NOT signed in. Redirect them to the auth page.
                alert("You must be logged in to view Account Settings.");
                // Redirects to houselearning.github.io/auth/
                window.location.href = 'https://houselearning.github.io/auth/'; 
            }
        });
    } else {
         showMessage(settingsUI.emailMessage, 'error', "Firebase is not initialized. Check your browser console and main.js file.");
    }
});
