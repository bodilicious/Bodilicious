import dotenv from "dotenv";
dotenv.config();

import { sendPasswordResetEmail } from "./email/emailService.js";

async function testEmail() {
  console.log("Testing Resend Email Configuration...");
  try {
    const toEmail = "jacksonraj0711@gmail.com"; // using the email from previous env
    const resetLink = "https://www.bodilicious.in/auth/action?mode=resetPassword&oobCode=testcode123";
    
    console.log(`Sending password reset email to: ${toEmail}`);
    const result = await sendPasswordResetEmail(toEmail, resetLink, "Test User");
    
    console.log("✅ Email sent successfully!");
    console.log("Resend Response:", result);
  } catch (error) {
    console.error("❌ Failed to send email.");
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Error response details:", error.response);
    }
  }
}

testEmail();
