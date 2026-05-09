import dotenv from 'dotenv';
dotenv.config();

const testLogin = async (email, password) => {
  console.log(`\nTesting login for: ${email}`);
  console.log(`Password length: ${password ? password.length : 0}`);
  
  try {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text}`);

    if (response.ok) {
      console.log(`SUCCESS for ${email}`);
      return true;
    }
  } catch (err) {
    console.error(`Fetch error for ${email}:`, err);
  }
  return false;
};

const run = async () => {
  // Test current .env credentials
  await testLogin(process.env.SHIPROCKET_EMAIL, process.env.SHIPROCKET_PASSWORD);
  
  // Test old credentials from logs/memory
  const oldEmail = "drcatassistant@gmail.com";
  const oldPass = "uV2l41DP#G^HE4%A9TDzems4UoOu!MVv";
  await testLogin(oldEmail, oldPass);
};

run();
