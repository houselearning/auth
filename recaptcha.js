const toggleAuthLink = document.getElementById("toggle-auth");
const formTitle = document.getElementById("form-title");
const recaptchaContainer = document.getElementById("recaptcha-container");
const authForm = document.getElementById("auth-form");
const errorMessage = document.getElementById("error-message");

toggleAuthLink.addEventListener("click", (e) => {
    e.preventDefault();
    if(formTitle.textContent === "Login") {
        // Switch to Sign Up
        formTitle.textContent = "Sign Up";
        toggleAuthLink.textContent = "Log In";
        recaptchaContainer.style.display = "block"; // show reCAPTCHA
    } else {
        // Switch back to Login
        formTitle.textContent = "Login";
        toggleAuthLink.textContent = "Sign Up";
        recaptchaContainer.style.display = "none"; // hide reCAPTCHA
    }
});

authForm.addEventListener("submit", function(e) {
    e.preventDefault();
    errorMessage.textContent = "";

    if(formTitle.textContent === "Sign Up") {
        // Check reCAPTCHA
        const captchaResponse = grecaptcha.getResponse();
        if(!captchaResponse) {
            errorMessage.textContent = "Please complete the CAPTCHA to Sign Up.";
            errorMessage.className = "error-message";
            return; // stop submission
        }
    }

    // Continue with normal login or sign-up logic
    // Example: firebase.auth().createUserWithEmailAndPassword(...) for Sign Up
    // or firebase.auth().signInWithEmailAndPassword(...) for Login

    console.log("Form submitted for", formTitle.textContent);
});
