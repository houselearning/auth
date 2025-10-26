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
                
                // DOM elements
                const resendButton = document.getElementById('resend-email-button');
                const statusMessage = document.getElementById('resend-status-message');

                resendButton.addEventListener('click', async () => {
                    const user = auth.currentUser;
                    statusMessage.textContent = '';
                    
                    if (user) {
                        resendButton.textContent = 'Sending...';
                        try {
                            // Reload the user to check if they clicked the link already
                            await user.reload(); 
                            if (user.emailVerified) {
                                statusMessage.textContent = 'Success! You are already verified. Redirecting...';
                                setTimeout(() => window.location.replace('dashboard.html'), 1500);
                                return;
                            }
                            
                            // Send the email again
                            await user.sendEmailVerification();
                            statusMessage.textContent = 'Email resent successfully! Check your inbox.';
                            resendButton.textContent = 'Email Sent!';
                            resendButton.disabled = true; // Prevent spamming
                            setTimeout(() => {
                                resendButton.textContent = 'Resend Verification Email';
                                resendButton.disabled = false;
                                statusMessage.textContent = '';
                            }, 60000); // Re-enable after 1 minute

                        } catch (error) {
                            console.error("Resend error:", error);
                            statusMessage.textContent = 'Error sending email. Please try again later.';
                            resendButton.textContent = 'Resend Verification Email';
                        }
                    } else {
                        statusMessage.textContent = 'You are not logged in. Please return to the login page to try again.';
                        setTimeout(() => window.location.replace('index.html'), 3000); // Assuming index.html is your login page
                    }
                });
